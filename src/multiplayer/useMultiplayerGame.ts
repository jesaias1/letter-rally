import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  advanceGameClock,
  createGame,
  startRound,
  submitClaim,
  submitFinalWord,
} from '../game/gameEngine'
import type { GameState, PlayerId } from '../game/types'
import { createInviteUrl, createRoomCode, getRoomCodeFromUrl } from './roomCode'
import { INITIAL_MATCH_WINS, recordMatchWin } from './matchWins'
import { supabase, supabaseConfigurationError } from './supabase'
import type {
  ActionPayload,
  ActionResultPayload,
  AssignmentPayload,
  ConnectionStatus,
  JoinRequestPayload,
  MatchWins,
  PlayerAction,
  PlayerFeedback,
  RoomSession,
  StatePayload,
} from './types'

const INITIAL_FEEDBACK: Record<PlayerId, PlayerFeedback> = {
  player1: { message: 'Waiting for the rally.', tone: 'neutral' },
  player2: { message: 'Waiting for the rally.', tone: 'neutral' },
}

interface BroadcastMessage<T> {
  payload: T
}

interface StoredMultiplayerState {
  session: RoomSession
  game: GameState
  matchWins: MatchWins
  localPlayerId?: PlayerId
  revision: number
}

const SESSION_STORAGE_KEY = 'letter-rally-multiplayer-session'

function loadStoredState(roomCode?: string): StoredMultiplayerState | undefined {
  if (!roomCode) return undefined
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!stored) return undefined
    const parsed = JSON.parse(stored) as StoredMultiplayerState
    return parsed.session.roomCode === roomCode ? parsed : undefined
  } catch {
    return undefined
  }
}

function saveStoredState(state: StoredMultiplayerState): void {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Recovery is best-effort when browser storage is unavailable.
  }
}

export function useMultiplayerGame() {
  const invitedRoomCode = getRoomCodeFromUrl()
  const [restoredState] = useState(() => loadStoredState(invitedRoomCode))
  const [session, setSession] = useState<RoomSession | null>(restoredState?.session ?? null)
  const [game, setGame] = useState<GameState>(() => restoredState?.game ?? createGame('Host', 'Rival'))
  const [now, setNow] = useState(() => Date.now())
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(restoredState ? 'connecting' : 'idle')
  const [connectedPlayers, setConnectedPlayers] = useState(0)
  const [localPlayerId, setLocalPlayerId] = useState<PlayerId | undefined>(restoredState?.localPlayerId)
  const [feedback, setFeedback] = useState(INITIAL_FEEDBACK)
  const [matchWins, setMatchWins] = useState(restoredState?.matchWins ?? INITIAL_MATCH_WINS)
  const [roomError, setRoomError] = useState<string>()

  const channelRef = useRef<RealtimeChannel | undefined>(undefined)
  const gameRef = useRef(game)
  const revisionRef = useRef(restoredState?.revision ?? 0)
  const guestClientIdRef = useRef<string | undefined>(undefined)
  const sessionRef = useRef<RoomSession | null>(null)
  const matchWinsRef = useRef(restoredState?.matchWins ?? INITIAL_MATCH_WINS)

  const inviteUrl = session ? createInviteUrl(session.roomCode) : undefined

  useEffect(() => {
    if (!session) return
    const storedState: StoredMultiplayerState = {
      session,
      game,
      matchWins,
      localPlayerId,
      revision: revisionRef.current,
    }
    saveStoredState(storedState)
  }, [game, localPlayerId, matchWins, session])

  const sendBroadcast = useCallback(async (event: string, payload: object) => {
    if (!channelRef.current) return
    await channelRef.current.send({ type: 'broadcast', event, payload })
  }, [])

  const publishState = useCallback(
    (nextGame: GameState, nextMatchWins = matchWinsRef.current) => {
      revisionRef.current += 1
      void sendBroadcast('state', {
        game: nextGame,
        matchWins: nextMatchWins,
        revision: revisionRef.current,
        hostId: sessionRef.current?.clientId ?? '',
      } satisfies StatePayload)
    },
    [sendBroadcast],
  )

  const commitAuthoritativeGame = useCallback(
    (nextGame: GameState) => {
      let nextMatchWins = matchWinsRef.current
      if (gameRef.current.status !== 'roundOver' && nextGame.status === 'roundOver') {
        nextMatchWins = recordMatchWin(nextMatchWins, nextGame.winner)
        matchWinsRef.current = nextMatchWins
        setMatchWins(nextMatchWins)
      }
      gameRef.current = nextGame
      setGame(nextGame)
      publishState(nextGame, nextMatchWins)
    },
    [publishState],
  )

  const returnActionFeedback = useCallback(
    (clientId: string, playerId: PlayerId, nextFeedback: PlayerFeedback) => {
      if (clientId === sessionRef.current?.clientId) {
        setFeedback((current) => ({ ...current, [playerId]: nextFeedback }))
        return
      }

      void sendBroadcast('action_result', {
        clientId,
        feedback: nextFeedback,
      } satisfies ActionResultPayload)
    },
    [sendBroadcast],
  )

  const processAuthoritativeAction = useCallback(
    (payload: ActionPayload) => {
      const activeSession = sessionRef.current
      if (!activeSession || activeSession.role !== 'host') return

      const allowedClient =
        (payload.playerId === 'player1' && payload.clientId === activeSession.clientId) ||
        (payload.playerId === 'player2' && payload.clientId === guestClientIdRef.current)
      if (!allowedClient) return

      const submittedAt = Date.now()
      if (payload.action.kind === 'claim') {
        const submission = submitClaim(
          gameRef.current,
          payload.playerId,
          payload.action.word,
          submittedAt,
        )
        const nextFeedback: PlayerFeedback = {
          letterId: gameRef.current.currentLetter?.id,
          message: submission.attempt.valid
            ? `${submission.attempt.normalizedWord} locked in at position ${submission.attempt.lockedPosition}.`
            : submission.attempt.reason ?? 'Claim rejected.',
          tone: submission.attempt.valid ? 'success' : 'error',
        }
        commitAuthoritativeGame(submission.state)
        returnActionFeedback(payload.clientId, payload.playerId, nextFeedback)
        return
      }

      if (payload.action.kind === 'finalWord') {
        const submission = submitFinalWord(
          gameRef.current,
          payload.playerId,
          payload.action.word,
          submittedAt,
        )
        const nextFeedback: PlayerFeedback = {
          message: submission.result.valid
            ? `${submission.result.normalizedWord} wins the rally.`
            : submission.result.reason ?? 'Final word rejected.',
          tone: submission.result.valid ? 'success' : 'error',
        }
        commitAuthoritativeGame(submission.state)
        returnActionFeedback(payload.clientId, payload.playerId, nextFeedback)
        return
      }

      if (payload.action.kind === 'playAgain' && payload.playerId === 'player1') {
        const restarted = startRound(
          createGame(gameRef.current.players.player1.name, gameRef.current.players.player2.name),
          submittedAt,
        )
        setFeedback(INITIAL_FEEDBACK)
        commitAuthoritativeGame(restarted)
      }
    },
    [commitAuthoritativeGame, returnActionFeedback],
  )

  useEffect(() => {
    sessionRef.current = session
    if (!session || !supabase) return
    const client = supabase

    const channel = client.channel(`letter-rally:${session.roomCode}`, {
      config: {
        broadcast: { ack: true },
        presence: { key: session.clientId },
      },
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const presence = channel.presenceState()
        const entries = Object.values(presence).flat() as Array<{ clientId?: string }>
        const clientIds = entries
          .map((entry) => String(entry.clientId ?? ''))
          .filter(Boolean)
        setConnectedPlayers(new Set(clientIds).size)
      })
      .on(
        'broadcast',
        { event: 'join_request' },
        ({ payload }: BroadcastMessage<JoinRequestPayload>) => {
          if (session.role !== 'host') return

          if (guestClientIdRef.current && guestClientIdRef.current !== payload.clientId) {
            void sendBroadcast('room_error', {
              clientId: payload.clientId,
              message: 'This room already has two players.',
            })
            return
          }

          guestClientIdRef.current = payload.clientId
          void sendBroadcast('assignment', {
            clientId: payload.clientId,
            playerId: 'player2',
            hostId: session.clientId,
          } satisfies AssignmentPayload)

          if (gameRef.current.status === 'idle') {
            const started = startRound(createGame(session.playerName, payload.playerName), Date.now())
            setFeedback(INITIAL_FEEDBACK)
            commitAuthoritativeGame(started)
          } else {
            publishState(gameRef.current)
          }
        },
      )
      .on(
        'broadcast',
        { event: 'assignment' },
        ({ payload }: BroadcastMessage<AssignmentPayload>) => {
          if (payload.clientId === session.clientId) setLocalPlayerId(payload.playerId)
        },
      )
      .on('broadcast', { event: 'state' }, ({ payload }: BroadcastMessage<StatePayload>) => {
        if (session.role === 'host' || payload.revision <= revisionRef.current) return
        revisionRef.current = payload.revision
        gameRef.current = payload.game
        matchWinsRef.current = payload.matchWins
        setGame(payload.game)
        setMatchWins(payload.matchWins)
      })
      .on('broadcast', { event: 'action' }, ({ payload }: BroadcastMessage<ActionPayload>) => {
        processAuthoritativeAction(payload)
      })
      .on(
        'broadcast',
        { event: 'action_result' },
        ({ payload }: BroadcastMessage<ActionResultPayload>) => {
          if (payload.clientId !== session.clientId) return
          setFeedback((current) => ({ ...current, player2: payload.feedback }))
        },
      )
      .on(
        'broadcast',
        { event: 'room_error' },
        ({ payload }: BroadcastMessage<{ clientId: string; message: string }>) => {
          if (payload.clientId === session.clientId) setRoomError(payload.message)
        },
      )
      .on('broadcast', { event: 'sync_request' }, () => {
        if (session.role === 'host') publishState(gameRef.current)
      })
      .on('broadcast', { event: 'host_ready' }, () => {
        if (session.role !== 'guest') return
        void sendBroadcast('join_request', {
          clientId: session.clientId,
          playerName: session.playerName,
        } satisfies JoinRequestPayload)
        void sendBroadcast('sync_request', { clientId: session.clientId })
      })
      .subscribe(async (status, error) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected')
          await channel.track({
            clientId: session.clientId,
            playerName: session.playerName,
            role: session.role,
            onlineAt: new Date().toISOString(),
          })

          if (session.role === 'guest') {
            await channel.send({
              type: 'broadcast',
              event: 'join_request',
              payload: { clientId: session.clientId, playerName: session.playerName },
            })
            await channel.send({
              type: 'broadcast',
              event: 'sync_request',
              payload: { clientId: session.clientId },
            })
          } else {
            await channel.send({
              type: 'broadcast',
              event: 'host_ready',
              payload: { clientId: session.clientId },
            })
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error')
          setRoomError(error?.message ?? 'Could not connect to the Supabase room.')
        }
      })

    return () => {
      channelRef.current = undefined
      void client.removeChannel(channel)
    }
  }, [commitAuthoritativeGame, processAuthoritativeAction, publishState, sendBroadcast, session])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const tickNow = Date.now()
      setNow(tickNow)

      if (sessionRef.current?.role !== 'host') return
      const nextGame = advanceGameClock(gameRef.current, tickNow)
      if (nextGame !== gameRef.current) commitAuthoritativeGame(nextGame)
    }, 50)

    return () => window.clearInterval(timer)
  }, [commitAuthoritativeGame])

  function createRoom(playerName: string) {
    const roomCode = createRoomCode()
    const nextSession: RoomSession = {
      roomCode,
      clientId: crypto.randomUUID(),
      playerName: playerName.trim() || 'Player One',
      role: 'host',
    }
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('room', roomCode)
    window.history.replaceState({}, '', url)
    setConnectionStatus('connecting')
    setRoomError(undefined)
    setLocalPlayerId('player1')
    gameRef.current = createGame(nextSession.playerName, 'Waiting for rival')
    matchWinsRef.current = INITIAL_MATCH_WINS
    setMatchWins(INITIAL_MATCH_WINS)
    setGame(gameRef.current)
    setSession(nextSession)
  }

  function joinRoom(playerName: string) {
    if (!invitedRoomCode) {
      setRoomError('This invite link does not contain a room code.')
      return
    }

    setConnectionStatus('connecting')
    setRoomError(undefined)
    setLocalPlayerId('player2')
    setSession({
      roomCode: invitedRoomCode,
      clientId: crypto.randomUUID(),
      playerName: playerName.trim() || 'Player Two',
      role: 'guest',
    })
  }

  function sendAction(action: PlayerAction) {
    if (!session || !localPlayerId) return
    const payload: ActionPayload = {
      clientId: session.clientId,
      playerId: localPlayerId,
      action,
    }

    if (session.role === 'host') {
      processAuthoritativeAction(payload)
      return
    }

    if (action.kind !== 'playAgain') {
      setFeedback((current) => ({
        ...current,
        [localPlayerId]: { message: 'Sent to host for validation...', tone: 'neutral' },
      }))
    }
    void sendBroadcast('action', payload)
  }

  return {
    configurationError: supabaseConfigurationError,
    invitedRoomCode,
    inviteUrl,
    session,
    game,
    now,
    connectionStatus,
    connectedPlayers,
    localPlayerId,
    feedback,
    matchWins,
    roomError,
    createRoom,
    joinRoom,
    submitClaim: (word: string) => sendAction({ kind: 'claim', word }),
    submitFinalWord: (word: string) => sendAction({ kind: 'finalWord', word }),
    playAgain: () => sendAction({ kind: 'playAgain' }),
  }
}

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
import { supabase, supabaseConfigurationError } from './supabase'
import type {
  ActionPayload,
  ActionResultPayload,
  AssignmentPayload,
  ConnectionStatus,
  JoinRequestPayload,
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

export function useMultiplayerGame() {
  const [session, setSession] = useState<RoomSession | null>(null)
  const [game, setGame] = useState<GameState>(() => createGame('Host', 'Rival'))
  const [now, setNow] = useState(() => Date.now())
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle')
  const [connectedPlayers, setConnectedPlayers] = useState(0)
  const [localPlayerId, setLocalPlayerId] = useState<PlayerId | undefined>()
  const [feedback, setFeedback] = useState(INITIAL_FEEDBACK)
  const [roomError, setRoomError] = useState<string>()

  const channelRef = useRef<RealtimeChannel | undefined>(undefined)
  const gameRef = useRef(game)
  const revisionRef = useRef(0)
  const guestClientIdRef = useRef<string | undefined>(undefined)
  const sessionRef = useRef<RoomSession | null>(null)

  const invitedRoomCode = getRoomCodeFromUrl()
  const inviteUrl = session ? createInviteUrl(session.roomCode) : undefined

  const sendBroadcast = useCallback(async (event: string, payload: object) => {
    if (!channelRef.current) return
    await channelRef.current.send({ type: 'broadcast', event, payload })
  }, [])

  const publishState = useCallback(
    (nextGame: GameState) => {
      revisionRef.current += 1
      void sendBroadcast('state', {
        game: nextGame,
        revision: revisionRef.current,
        hostId: sessionRef.current?.clientId ?? '',
      } satisfies StatePayload)
    },
    [sendBroadcast],
  )

  const commitAuthoritativeGame = useCallback(
    (nextGame: GameState) => {
      gameRef.current = nextGame
      setGame(nextGame)
      publishState(nextGame)
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
        gameRef.current = submission.state
        setGame(submission.state)
        publishState(submission.state)
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
        gameRef.current = submission.state
        setGame(submission.state)
        publishState(submission.state)
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
    [commitAuthoritativeGame, publishState, returnActionFeedback],
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
        setConnectedPlayers(Object.values(presence).flat().length)
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
        setGame(payload.game)
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
    roomError,
    createRoom,
    joinRoom,
    submitClaim: (word: string) => sendAction({ kind: 'claim', word }),
    submitFinalWord: (word: string) => sendAction({ kind: 'finalWord', word }),
    playAgain: () => sendAction({ kind: 'playAgain' }),
  }
}

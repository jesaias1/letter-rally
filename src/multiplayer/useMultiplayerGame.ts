import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  advanceGameClock,
  createGame,
  startRound,
  submitClaim,
  submitFinalWord,
  activatePowerUp,
} from '../game/gameEngine'
import { saveReplay, type ReplayFrame } from '../game/replay'
import type { GameRules } from '../game/rules'
import type { GameState, PlayerId, PowerUpKind } from '../game/types'
import { hydrateGameState } from '../game/stateCompatibility'
import { createSeries, recordSeriesRound, type SeriesLength, type SeriesState } from '../game/series'
import { createInviteUrl, createRoomCode, getRoomCodeFromUrl, normalizeRoomCode } from './roomCode'
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
  SpectateRequestPayload,
} from './types'
import { loadStatistics, saveStatistics } from '../progress/playerProgress'

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
  series: SeriesState
  localPlayerId?: PlayerId
  revision: number
  replayFrames: ReplayFrame[]
}

const SESSION_STORAGE_KEY = 'letter-rally-multiplayer-session'

function loadStoredState(roomCode?: string): StoredMultiplayerState | undefined {
  if (!roomCode) return undefined
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!stored) return undefined
    const parsed = JSON.parse(stored) as StoredMultiplayerState
    if (parsed.session.roomCode !== roomCode) return undefined
    return {
      ...parsed,
      game: hydrateGameState(parsed.game),
      replayFrames: (parsed.replayFrames ?? []).map((frame) => ({ ...frame, game: hydrateGameState(frame.game) })),
    }
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
  const [series, setSeries] = useState<SeriesState>(restoredState?.series ?? createSeries(3))
  const [roomError, setRoomError] = useState<string>()
  const [spectatorCount, setSpectatorCount] = useState(0)

  const channelRef = useRef<RealtimeChannel | undefined>(undefined)
  const gameRef = useRef(game)
  const revisionRef = useRef(restoredState?.revision ?? 0)
  const guestClientIdRef = useRef<string | undefined>(undefined)
  const sessionRef = useRef<RoomSession | null>(null)
  const seriesRef = useRef(restoredState?.series ?? createSeries(3))
  const replayFramesRef = useRef<ReplayFrame[]>(restoredState?.replayFrames ?? [])
  const recordedSeriesRef = useRef('')

  const inviteUrl = session ? createInviteUrl(session.roomCode) : undefined

  useEffect(() => {
    if (!session) return
    const storedState: StoredMultiplayerState = {
      session,
      game,
      series,
      localPlayerId,
      revision: revisionRef.current,
      replayFrames: replayFramesRef.current,
    }
    saveStoredState(storedState)
  }, [game, localPlayerId, series, session])

  const sendBroadcast = useCallback(async (event: string, payload: object) => {
    if (!channelRef.current) return
    await channelRef.current.send({ type: 'broadcast', event, payload })
  }, [])

  const recordStatistic = useCallback((statistic: ActionResultPayload['statistic']) => {
    if (!statistic) return
    const current = loadStatistics()
    saveStatistics({
      ...current,
      validClaims: current.validClaims + (statistic === 'validClaim' ? 1 : 0),
      finalWords: current.finalWords + (statistic === 'finalWord' ? 1 : 0),
      powerUpsUsed: current.powerUpsUsed + (statistic === 'powerUp' ? 1 : 0),
    })
  }, [])

  const publishState = useCallback(
    (nextGame: GameState, nextSeries = seriesRef.current) => {
      revisionRef.current += 1
      void sendBroadcast('state', {
        game: nextGame,
        series: nextSeries,
        revision: revisionRef.current,
        hostId: sessionRef.current?.clientId ?? '',
        replayFrames: replayFramesRef.current,
      } satisfies StatePayload)
    },
    [sendBroadcast],
  )

  const commitAuthoritativeGame = useCallback(
    (nextGame: GameState) => {
      let nextSeries = seriesRef.current
      if (gameRef.current.status !== 'roundOver' && nextGame.status === 'roundOver') {
        nextSeries = recordSeriesRound(nextSeries, nextGame)
        seriesRef.current = nextSeries
        setSeries(nextSeries)
      }
      gameRef.current = nextGame
      setGame(nextGame)
      replayFramesRef.current.push({ capturedAt: Date.now(), game: nextGame, series: nextSeries })
      publishState(nextGame, nextSeries)
    },
    [publishState],
  )

  const returnActionFeedback = useCallback(
    (clientId: string, playerId: PlayerId, nextFeedback: PlayerFeedback, statistic?: ActionResultPayload['statistic']) => {
      if (clientId === sessionRef.current?.clientId) {
        setFeedback((current) => ({ ...current, [playerId]: nextFeedback }))
        recordStatistic(statistic)
        return
      }

      void sendBroadcast('action_result', {
        clientId,
        feedback: nextFeedback,
        statistic,
      } satisfies ActionResultPayload)
    },
    [recordStatistic, sendBroadcast],
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
        returnActionFeedback(payload.clientId, payload.playerId, nextFeedback, submission.attempt.valid ? 'validClaim' : undefined)
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
        returnActionFeedback(payload.clientId, payload.playerId, nextFeedback, submission.result.valid ? 'finalWord' : undefined)
        return
      }

      if (payload.action.kind === 'powerUp') {
        const activation = activatePowerUp(
          gameRef.current,
          payload.playerId,
          payload.action.powerUp,
          submittedAt,
        )
        const nextFeedback: PlayerFeedback = {
          message: activation.result.valid
            ? payload.action.powerUp === 'swap'
              ? 'Last tile swapped.'
              : 'Last tile protected from its unused penalty.'
            : activation.result.reason ?? 'Power-up unavailable.',
          tone: activation.result.valid ? 'success' : 'error',
        }
        commitAuthoritativeGame(activation.state)
        returnActionFeedback(payload.clientId, payload.playerId, nextFeedback, activation.result.valid ? 'powerUp' : undefined)
        return
      }

      if (payload.action.kind === 'playAgain' && payload.playerId === 'player1') {
        if (seriesRef.current.complete) {
          seriesRef.current = createSeries(seriesRef.current.roundsToPlay)
          setSeries(seriesRef.current)
          replayFramesRef.current = []
        }
        const restarted = startRound(
          createGame(
            gameRef.current.players.player1.name,
            gameRef.current.players.player2.name,
            gameRef.current.rules,
          ),
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
        const entries = Object.values(presence).flat() as Array<{ clientId?: string; role?: RoomSession['role'] }>
        const playerIds = entries.filter((entry) => entry.role !== 'spectator').map((entry) => String(entry.clientId ?? '')).filter(Boolean)
        const spectatorIds = entries.filter((entry) => entry.role === 'spectator').map((entry) => String(entry.clientId ?? '')).filter(Boolean)
        setConnectedPlayers(new Set(playerIds).size)
        setSpectatorCount(new Set(spectatorIds).size)
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
            const started = startRound(
              createGame(session.playerName, payload.playerName, gameRef.current.rules),
              Date.now(),
            )
            setFeedback(INITIAL_FEEDBACK)
            commitAuthoritativeGame(started)
          } else {
            publishState(gameRef.current)
          }
        },
      )
      .on(
        'broadcast',
        { event: 'spectate_request' },
        ({ payload }: BroadcastMessage<SpectateRequestPayload>) => {
          if (session.role === 'host' && payload.clientId) publishState(gameRef.current)
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
        const hydratedGame = hydrateGameState(payload.game)
        gameRef.current = hydratedGame
        seriesRef.current = payload.series
        replayFramesRef.current = (payload.replayFrames ?? []).map((frame) => ({
          ...frame,
          game: hydrateGameState(frame.game),
        }))
        setGame(hydratedGame)
        setSeries(payload.series)
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
          recordStatistic(payload.statistic)
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
        if (session.role === 'host') return
        if (session.role === 'guest') {
          void sendBroadcast('join_request', {
            clientId: session.clientId,
            playerName: session.playerName,
          } satisfies JoinRequestPayload)
        } else {
          void sendBroadcast('spectate_request', {
            clientId: session.clientId,
            playerName: session.playerName,
          } satisfies SpectateRequestPayload)
        }
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
          } else if (session.role === 'spectator') {
            await channel.send({
              type: 'broadcast',
              event: 'spectate_request',
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
  }, [commitAuthoritativeGame, processAuthoritativeAction, publishState, recordStatistic, sendBroadcast, session])

  useEffect(() => {
    if (!session || !localPlayerId || !series.complete) return
    const completionId = `${session.roomCode}:${series.roundsPlayed}:${series.totalScore.player1}:${series.totalScore.player2}`
    if (recordedSeriesRef.current === completionId) return
    recordedSeriesRef.current = completionId
    const current = loadStatistics()
    const won = series.winner === localPlayerId
    const lost = Boolean(series.winner && !won)
    saveStatistics({
      ...current,
      seriesPlayed: current.seriesPlayed + 1,
      seriesWon: current.seriesWon + (won ? 1 : 0),
      seriesLost: current.seriesLost + (lost ? 1 : 0),
      seriesDrawn: current.seriesDrawn + (series.winner ? 0 : 1),
      roundsWon: current.roundsWon + series.roundWins[localPlayerId],
      bestSeriesScore: Math.max(current.bestSeriesScore, series.totalScore[localPlayerId]),
    })
    saveReplay({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      label: `ONLINE ${series.totalScore.player1}:${series.totalScore.player2}`,
      frames: replayFramesRef.current,
    })
  }, [localPlayerId, series, session])

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

  function createRoom(playerName: string, roundsToPlay: SeriesLength, rules: GameRules) {
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
    gameRef.current = createGame(nextSession.playerName, 'Waiting for rival', rules)
    replayFramesRef.current = []
    seriesRef.current = createSeries(roundsToPlay)
    setSeries(seriesRef.current)
    setGame(gameRef.current)
    setSession(nextSession)
  }

  function joinRoom(playerName: string, enteredRoomCode?: string) {
    const roomCode = normalizeRoomCode(enteredRoomCode || invitedRoomCode)
    if (roomCode.length !== 6) {
      setRoomError('Enter a six-character room code.')
      return false
    }

    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('room', roomCode)
    window.history.replaceState({}, '', url)

    setConnectionStatus('connecting')
    setRoomError(undefined)
    setLocalPlayerId('player2')
    setSession({
      roomCode,
      clientId: crypto.randomUUID(),
      playerName: playerName.trim() || 'Player Two',
      role: 'guest',
    })
    return true
  }

  function spectateRoom(playerName: string, enteredRoomCode: string) {
    const roomCode = normalizeRoomCode(enteredRoomCode)
    if (roomCode.length !== 6) {
      setRoomError('Enter a six-character room code.')
      return false
    }
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('room', roomCode)
    url.searchParams.set('spectate', '1')
    window.history.replaceState({}, '', url)
    setConnectionStatus('connecting')
    setRoomError(undefined)
    setLocalPlayerId(undefined)
    setSession({
      roomCode,
      clientId: crypto.randomUUID(),
      playerName: playerName.trim() || 'Spectator',
      role: 'spectator',
    })
    return true
  }

  function sendAction(action: PlayerAction) {
    if (!session || !localPlayerId || session.role === 'spectator') return
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
    spectatorCount,
    localPlayerId,
    feedback,
    series,
    roomError,
    createRoom,
    joinRoom,
    spectateRoom,
    submitClaim: (word: string) => sendAction({ kind: 'claim', word }),
    submitFinalWord: (word: string) => sendAction({ kind: 'finalWord', word }),
    usePowerUp: (powerUp: PowerUpKind) => sendAction({ kind: 'powerUp', powerUp }),
    playAgain: () => sendAction({ kind: 'playAgain' }),
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  advanceGameClock,
  createGame,
  startRound,
  submitClaim,
  submitFinalWord,
  activatePowerUp as activatePowerUpInGame,
} from '../game/gameEngine'
import { loadReplays, saveReplay, type ReplayFrame, type SavedReplay } from '../game/replay'
import type { GameRules } from '../game/rules'
import { createSeries, recordSeriesRound, type SeriesLength, type SeriesState } from '../game/series'
import type { GameState, PlayerId, PowerUpKind } from '../game/types'
import type { PlayerFeedback } from '../multiplayer/types'
import { loadStatistics, saveStatistics, type PlayerStatistics } from '../progress/playerProgress'
import { BOT_SETTINGS, chooseBotClaimWord, chooseBotFinalWord, getBotReactionDelay, type BotDifficulty } from './bot'
import { loadBotRecords, recordBotResult, saveBotRecords, type BotRecords } from './records'

const INITIAL_FEEDBACK: Record<PlayerId, PlayerFeedback> = {
  player1: { message: 'Waiting for the rally.', tone: 'neutral' },
  player2: { message: 'The bot is sizing up the board.', tone: 'neutral' },
}

interface SinglePlayerSession {
  difficulty: BotDifficulty
  playerName: string
  roundsToPlay: SeriesLength
  rules: GameRules
}

export function useSinglePlayerGame() {
  const [session, setSession] = useState<SinglePlayerSession | null>(null)
  const [game, setGame] = useState<GameState>(() => createGame('Player One', 'Rally Bot'))
  const [now, setNow] = useState(() => Date.now())
  const [feedback, setFeedback] = useState(INITIAL_FEEDBACK)
  const [series, setSeries] = useState<SeriesState>(() => createSeries(3))
  const [botRecords, setBotRecords] = useState<BotRecords>(() => loadBotRecords())
  const [statistics, setStatistics] = useState<PlayerStatistics>(() => loadStatistics())
  const [replays, setReplays] = useState<SavedReplay[]>(() => loadReplays())

  const sessionRef = useRef(session)
  const gameRef = useRef(game)
  const seriesRef = useRef(series)
  const finalAttemptBoardRef = useRef('')
  const plannedLetterRef = useRef('')
  const letterRandomRef = useRef<() => number>(Math.random)
  const botRandomRef = useRef<() => number>(Math.random)
  const replayFramesRef = useRef<ReplayFrame[]>([])

  const updateStatistics = useCallback((update: (current: PlayerStatistics) => PlayerStatistics) => {
    setStatistics((current) => {
      const next = update(current)
      saveStatistics(next)
      return next
    })
  }, [])

  const commitGame = useCallback((nextGame: GameState) => {
    const previousGame = gameRef.current
    gameRef.current = nextGame
    setGame(nextGame)

    let nextSeries = seriesRef.current
    if (previousGame.status !== 'roundOver' && nextGame.status === 'roundOver') {
      nextSeries = recordSeriesRound(nextSeries, nextGame)
      seriesRef.current = nextSeries
      setSeries(nextSeries)

      if (nextSeries.complete) {
        const activeSession = sessionRef.current
        if (activeSession) {
          setBotRecords((current) => {
            const nextRecords = recordBotResult(current, activeSession.difficulty, nextSeries.winner)
            saveBotRecords(nextRecords)
            return nextRecords
          })
          updateStatistics((current) => ({
            ...current,
            seriesPlayed: current.seriesPlayed + 1,
            seriesWon: current.seriesWon + (nextSeries.winner === 'player1' ? 1 : 0),
            seriesLost: current.seriesLost + (nextSeries.winner === 'player2' ? 1 : 0),
            seriesDrawn: current.seriesDrawn + (nextSeries.winner ? 0 : 1),
            roundsWon: current.roundsWon + nextSeries.roundWins.player1,
            bestSeriesScore: Math.max(current.bestSeriesScore, nextSeries.totalScore.player1),
          }))
          const replay: SavedReplay = {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            label: `${activeSession.difficulty.toUpperCase()} ${nextSeries.totalScore.player1}:${nextSeries.totalScore.player2}`,
            frames: [...replayFramesRef.current, { capturedAt: Date.now(), game: nextGame, series: nextSeries }],
          }
          setReplays(saveReplay(replay))
        }
      }
    }

    replayFramesRef.current.push({ capturedAt: Date.now(), game: nextGame, series: nextSeries })
  }, [updateStatistics])

  useEffect(() => { sessionRef.current = session }, [session])

  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => {
      const tickNow = Date.now()
      setNow(tickNow)
      const nextGame = advanceGameClock(gameRef.current, tickNow, letterRandomRef.current)
      if (nextGame !== gameRef.current) commitGame(nextGame)
    }, 50)
    return () => window.clearInterval(timer)
  }, [commitGame, session])

  useEffect(() => {
    const currentLetter = game.currentLetter
    const difficulty = session?.difficulty
    if (!difficulty || game.status !== 'playing' || !currentLetter || currentLetter.resolved) return
    if (plannedLetterRef.current === currentLetter.id) return
    plannedLetterRef.current = currentLetter.id
    const word = chooseBotClaimWord(currentLetter.letter, game.players.player2, difficulty, botRandomRef.current)
    if (!word) return
    const letterId = currentLetter.id
    const timer = window.setTimeout(() => {
      const activeGame = gameRef.current
      if (activeGame.status !== 'playing' || activeGame.currentLetter?.id !== letterId) return
      const submission = submitClaim(activeGame, 'player2', word, Date.now())
      setFeedback((current) => ({ ...current, player2: { letterId, message: submission.attempt.valid ? 'Bot locked in.' : 'Bot missed its chance.', tone: submission.attempt.valid ? 'success' : 'neutral' } }))
      commitGame(submission.state)
    }, getBotReactionDelay(difficulty, botRandomRef.current))
    return () => window.clearTimeout(timer)
  }, [commitGame, game.currentLetter, game.players.player2, game.status, session?.difficulty])

  useEffect(() => {
    const difficulty = session?.difficulty
    const activeStatus = gameRef.current.status
    if (!difficulty || (activeStatus !== 'playing' && activeStatus !== 'letterResolution')) return
    const botBoard = game.players.player2.board
    const signature = botBoard.map((tile) => tile.id).join('|')
    if (botBoard.length < BOT_SETTINGS[difficulty].finalWordMinimumTiles || finalAttemptBoardRef.current === signature) return
    const finalWord = chooseBotFinalWord(botBoard)
    if (!finalWord) return
    finalAttemptBoardRef.current = signature
    const timer = window.setTimeout(() => {
      const submission = submitFinalWord(gameRef.current, 'player2', finalWord, Date.now())
      if (submission.result.valid) commitGame(submission.state)
    }, BOT_SETTINGS[difficulty].finalWordDelay)
    return () => window.clearTimeout(timer)
  }, [commitGame, game.players.player2.board, session?.difficulty])

  function beginSession(playerName: string, difficulty: BotDifficulty, roundsToPlay: SeriesLength, rules: GameRules) {
    const normalizedName = playerName.trim() || 'Player One'
    const nextSession = { difficulty, playerName: normalizedName, roundsToPlay, rules }
    const nextSeries = createSeries(roundsToPlay)
    const nextGame = startRound(createGame(normalizedName, BOT_SETTINGS[difficulty].name, rules), Date.now())
    letterRandomRef.current = Math.random
    botRandomRef.current = Math.random
    finalAttemptBoardRef.current = ''
    plannedLetterRef.current = ''
    replayFramesRef.current = [{ capturedAt: Date.now(), game: nextGame, series: nextSeries }]
    seriesRef.current = nextSeries
    setSeries(nextSeries)
    setFeedback(INITIAL_FEEDBACK)
    setSession(nextSession)
    sessionRef.current = nextSession
    gameRef.current = nextGame
    setGame(nextGame)
  }

  function startGame(playerName: string, difficulty: BotDifficulty, roundsToPlay: SeriesLength, rules: GameRules) {
    beginSession(playerName, difficulty, roundsToPlay, rules)
  }

  function submitPlayerClaim(word: string) {
    const submission = submitClaim(gameRef.current, 'player1', word, Date.now())
    if (submission.attempt.valid) updateStatistics((current) => ({ ...current, validClaims: current.validClaims + 1 }))
    setFeedback((current) => ({ ...current, player1: { letterId: gameRef.current.currentLetter?.id, message: submission.attempt.valid ? `${submission.attempt.normalizedWord} locked in at position ${submission.attempt.lockedPosition}.` : submission.attempt.reason ?? 'Claim rejected.', tone: submission.attempt.valid ? 'success' : 'error' } }))
    commitGame(submission.state)
  }

  function submitPlayerFinalWord(word: string) {
    const submission = submitFinalWord(gameRef.current, 'player1', word, Date.now())
    if (submission.result.valid) updateStatistics((current) => ({ ...current, finalWords: current.finalWords + 1 }))
    setFeedback((current) => ({ ...current, player1: { message: submission.result.valid ? `${submission.result.normalizedWord} wins the rally.` : submission.result.reason ?? 'Final word rejected.', tone: submission.result.valid ? 'success' : 'error' } }))
    commitGame(submission.state)
  }

  function activatePowerUp(powerUp: PowerUpKind) {
    const activation = activatePowerUpInGame(gameRef.current, 'player1', powerUp, Date.now(), letterRandomRef.current)
    if (activation.result.valid) updateStatistics((current) => ({ ...current, powerUpsUsed: current.powerUpsUsed + 1 }))
    setFeedback((current) => ({ ...current, player1: { message: activation.result.valid ? `${powerUp === 'swap' ? 'Tile swapped.' : 'Last tile shielded.'}` : activation.result.reason ?? 'Power-up unavailable.', tone: activation.result.valid ? 'success' : 'error' } }))
    commitGame(activation.state)
  }

  function playAgain() {
    const activeSession = sessionRef.current
    if (!activeSession) return
    if (seriesRef.current.complete) {
      seriesRef.current = createSeries(activeSession.roundsToPlay)
      setSeries(seriesRef.current)
      replayFramesRef.current = []
    }
    const restarted = startRound(createGame(activeSession.playerName, BOT_SETTINGS[activeSession.difficulty].name, activeSession.rules), Date.now())
    finalAttemptBoardRef.current = ''
    plannedLetterRef.current = ''
    setFeedback(INITIAL_FEEDBACK)
    commitGame(restarted)
  }

  function leaveGame() {
    setSession(null)
    sessionRef.current = null
    gameRef.current = createGame('Player One', 'Rally Bot')
    setGame(gameRef.current)
  }

  return { session, game, now, localPlayerId: 'player1' as const, feedback, series, botRecords, statistics, replays, startGame, submitClaim: submitPlayerClaim, submitFinalWord: submitPlayerFinalWord, usePowerUp: activatePowerUp, playAgain, leaveGame }
}

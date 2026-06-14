import { useCallback, useEffect, useRef, useState } from 'react'
import {
  advanceGameClock,
  createGame,
  startRound,
  submitClaim,
  submitFinalWord,
} from '../game/gameEngine'
import type { GameState, PlayerId } from '../game/types'
import { createSeries, recordSeriesRound, type SeriesLength, type SeriesState } from '../game/series'
import type { PlayerFeedback } from '../multiplayer/types'
import { BOT_SETTINGS, chooseBotClaimWord, chooseBotFinalWord, getBotReactionDelay, type BotDifficulty } from './bot'
import {
  loadBotRecords,
  recordBotResult,
  saveBotRecords,
  type BotRecords,
} from './records'

const INITIAL_FEEDBACK: Record<PlayerId, PlayerFeedback> = {
  player1: { message: 'Waiting for the rally.', tone: 'neutral' },
  player2: { message: 'The bot is sizing up the board.', tone: 'neutral' },
}

interface SinglePlayerSession {
  difficulty: BotDifficulty
  playerName: string
  roundsToPlay: SeriesLength
}

export function useSinglePlayerGame() {
  const [session, setSession] = useState<SinglePlayerSession | null>(null)
  const [game, setGame] = useState<GameState>(() => createGame('Player One', 'Rally Bot'))
  const [now, setNow] = useState(() => Date.now())
  const [feedback, setFeedback] = useState(INITIAL_FEEDBACK)
  const [series, setSeries] = useState<SeriesState>(() => createSeries(3))
  const [botRecords, setBotRecords] = useState<BotRecords>(() => loadBotRecords())

  const sessionRef = useRef(session)
  const gameRef = useRef(game)
  const seriesRef = useRef(series)
  const finalAttemptBoardRef = useRef('')
  const plannedLetterRef = useRef('')

  const commitGame = useCallback((nextGame: GameState) => {
    const previousGame = gameRef.current
    gameRef.current = nextGame
    setGame(nextGame)

    if (previousGame.status !== 'roundOver' && nextGame.status === 'roundOver') {
      const nextSeries = recordSeriesRound(seriesRef.current, nextGame)
      seriesRef.current = nextSeries
      setSeries(nextSeries)

      const difficulty = sessionRef.current?.difficulty
      if (difficulty && nextSeries.complete) {
        setBotRecords((current) => {
          const nextRecords = recordBotResult(current, difficulty, nextSeries.winner)
          saveBotRecords(nextRecords)
          return nextRecords
        })
      }
    }
  }, [])

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    if (!session) return
    const timer = window.setInterval(() => {
      const tickNow = Date.now()
      setNow(tickNow)
      const nextGame = advanceGameClock(gameRef.current, tickNow)
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

    const bot = game.players.player2
    const word = chooseBotClaimWord(currentLetter.letter, bot, difficulty)
    if (!word) return

    const letterId = currentLetter.id
    const timer = window.setTimeout(() => {
      const activeGame = gameRef.current
      if (activeGame.status !== 'playing' || activeGame.currentLetter?.id !== letterId) return
      const submission = submitClaim(activeGame, 'player2', word, Date.now())
      setFeedback((current) => ({
        ...current,
        player2: {
          letterId,
          message: submission.attempt.valid ? 'Bot locked in.' : 'Bot missed its chance.',
          tone: submission.attempt.valid ? 'success' : 'neutral',
        },
      }))
      commitGame(submission.state)
    }, getBotReactionDelay(difficulty))

    return () => window.clearTimeout(timer)
  }, [commitGame, game.currentLetter, game.players.player2, game.status, session?.difficulty])

  useEffect(() => {
    const difficulty = session?.difficulty
    const activeStatus = gameRef.current.status
    if (!difficulty || (activeStatus !== 'playing' && activeStatus !== 'letterResolution')) return

    const botBoard = game.players.player2.board
    const signature = botBoard.map((tile) => tile.id).join('|')
    if (
      botBoard.length < BOT_SETTINGS[difficulty].finalWordMinimumTiles ||
      finalAttemptBoardRef.current === signature
    ) return

    const finalWord = chooseBotFinalWord(botBoard)
    if (!finalWord) return
    finalAttemptBoardRef.current = signature

    const timer = window.setTimeout(() => {
      const activeGame = gameRef.current
      const submission = submitFinalWord(activeGame, 'player2', finalWord, Date.now())
      if (submission.result.valid) commitGame(submission.state)
    }, BOT_SETTINGS[difficulty].finalWordDelay)

    return () => window.clearTimeout(timer)
  }, [commitGame, game.players.player2.board, session?.difficulty])

  function startGame(playerName: string, difficulty: BotDifficulty, roundsToPlay: SeriesLength) {
    const normalizedName = playerName.trim() || 'Player One'
    const nextSession = { difficulty, playerName: normalizedName, roundsToPlay }
    const nextGame = startRound(createGame(normalizedName, BOT_SETTINGS[difficulty].name), Date.now())
    finalAttemptBoardRef.current = ''
    plannedLetterRef.current = ''
    seriesRef.current = createSeries(roundsToPlay)
    setSeries(seriesRef.current)
    setFeedback(INITIAL_FEEDBACK)
    setSession(nextSession)
    sessionRef.current = nextSession
    gameRef.current = nextGame
    setGame(nextGame)
  }

  function submitPlayerClaim(word: string) {
    const submission = submitClaim(gameRef.current, 'player1', word, Date.now())
    setFeedback((current) => ({
      ...current,
      player1: {
        letterId: gameRef.current.currentLetter?.id,
        message: submission.attempt.valid
          ? `${submission.attempt.normalizedWord} locked in at position ${submission.attempt.lockedPosition}.`
          : submission.attempt.reason ?? 'Claim rejected.',
        tone: submission.attempt.valid ? 'success' : 'error',
      },
    }))
    commitGame(submission.state)
  }

  function submitPlayerFinalWord(word: string) {
    const submission = submitFinalWord(gameRef.current, 'player1', word, Date.now())
    setFeedback((current) => ({
      ...current,
      player1: {
        message: submission.result.valid
          ? `${submission.result.normalizedWord} wins the rally.`
          : submission.result.reason ?? 'Final word rejected.',
        tone: submission.result.valid ? 'success' : 'error',
      },
    }))
    commitGame(submission.state)
  }

  function playAgain() {
    if (!sessionRef.current) return
    if (seriesRef.current.complete) {
      seriesRef.current = createSeries(sessionRef.current.roundsToPlay)
      setSeries(seriesRef.current)
    }
    const restarted = startRound(
      createGame(sessionRef.current.playerName, BOT_SETTINGS[sessionRef.current.difficulty].name),
      Date.now(),
    )
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

  return {
    session,
    game,
    now,
    localPlayerId: 'player1' as const,
    feedback,
    series,
    botRecords,
    startGame,
    submitClaim: submitPlayerClaim,
    submitFinalWord: submitPlayerFinalWord,
    playAgain,
    leaveGame,
  }
}

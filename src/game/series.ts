import type { GameState, PlayerId } from './types'

export type SeriesLength = 3 | 4 | 5
export type PlayerTotals = Record<PlayerId, number>

export interface SeriesState {
  roundsToPlay: SeriesLength
  roundsPlayed: number
  roundWins: PlayerTotals
  totalScore: PlayerTotals
  complete: boolean
  winner?: PlayerId
}

const EMPTY_TOTALS: PlayerTotals = { player1: 0, player2: 0 }

export function createSeries(roundsToPlay: SeriesLength): SeriesState {
  return {
    roundsToPlay,
    roundsPlayed: 0,
    roundWins: { ...EMPTY_TOTALS },
    totalScore: { ...EMPTY_TOTALS },
    complete: false,
  }
}

export function recordSeriesRound(series: SeriesState, game: GameState): SeriesState {
  const roundsPlayed = series.roundsPlayed + 1
  const roundWins = game.winner
    ? { ...series.roundWins, [game.winner]: series.roundWins[game.winner] + 1 }
    : series.roundWins
  const totalScore = {
    player1: series.totalScore.player1 + game.players.player1.score,
    player2: series.totalScore.player2 + game.players.player2.score,
  }
  const complete = roundsPlayed >= series.roundsToPlay
  const winner = !complete || totalScore.player1 === totalScore.player2
    ? undefined
    : totalScore.player1 > totalScore.player2 ? 'player1' : 'player2'

  return { ...series, roundsPlayed, roundWins, totalScore, complete, winner }
}

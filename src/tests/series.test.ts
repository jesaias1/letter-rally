import { describe, expect, it } from 'vitest'
import { createGame } from '../game/gameEngine'
import { createSeries, recordSeriesRound } from '../game/series'

function scoredRound(playerOneScore: number, playerTwoScore: number, winner?: 'player1' | 'player2') {
  const game = createGame()
  game.status = 'roundOver'
  game.players.player1.score = playerOneScore
  game.players.player2.score = playerTwoScore
  game.winner = winner
  return game
}

describe('cumulative series', () => {
  it('carries positive and negative scores into the series total', () => {
    let series = createSeries(3)
    series = recordSeriesRound(series, scoredRound(8, -6, 'player1'))
    series = recordSeriesRound(series, scoredRound(-4, 7, 'player2'))
    expect(series.totalScore).toEqual({ player1: 4, player2: 1 })
    expect(series.roundWins).toEqual({ player1: 1, player2: 1 })
    expect(series.complete).toBe(false)
  })

  it('chooses the champion by cumulative score after all rounds', () => {
    let series = createSeries(3)
    series = recordSeriesRound(series, scoredRound(10, 2, 'player1'))
    series = recordSeriesRound(series, scoredRound(-8, 4, 'player2'))
    series = recordSeriesRound(series, scoredRound(3, 1, 'player1'))
    expect(series.roundWins.player1).toBe(2)
    expect(series.totalScore).toEqual({ player1: 5, player2: 7 })
    expect(series.complete).toBe(true)
    expect(series.winner).toBe('player2')
  })
})

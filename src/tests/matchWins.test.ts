import { describe, expect, it } from 'vitest'
import { INITIAL_MATCH_WINS, recordMatchWin } from '../multiplayer/matchWins'

describe('match wins', () => {
  it('keeps a running tally between rematches', () => {
    const firstWin = recordMatchWin(INITIAL_MATCH_WINS, 'player1')
    const secondWin = recordMatchWin(firstWin, 'player2')
    const thirdWin = recordMatchWin(secondWin, 'player1')

    expect(thirdWin).toEqual({ player1: 2, player2: 1 })
  })

  it('does not award a win for a draw', () => {
    expect(recordMatchWin(INITIAL_MATCH_WINS)).toBe(INITIAL_MATCH_WINS)
  })
})

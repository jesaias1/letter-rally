import { describe, expect, it } from 'vitest'
import {
  createGame,
  pickClaimWinner,
  resolveCurrentLetter,
  revealNextLetter,
  startRound,
  submitClaim,
} from '../game/gameEngine'
import type { ClaimAttempt } from '../game/types'

function claim(overrides: Partial<ClaimAttempt>): ClaimAttempt {
  return {
    playerId: 'player1',
    word: 'HARD',
    normalizedWord: 'HARD',
    submittedAt: 100,
    valid: true,
    lockedPosition: 1,
    ...overrides,
  }
}

describe('claim resolution', () => {
  it('awards the fastest valid claim', () => {
    const winner = pickClaimWinner([
      claim({ playerId: 'player1', submittedAt: 100 }),
      claim({ playerId: 'player2', submittedAt: 150, normalizedWord: 'SHOE' }),
    ])
    expect(winner?.playerId).toBe('player1')
  })

  it('uses longer word inside the tie threshold', () => {
    const winner = pickClaimWinner([
      claim({ playerId: 'player1', submittedAt: 100, normalizedWord: 'HARD' }),
      claim({ playerId: 'player2', submittedAt: 105, normalizedWord: 'GHOST' }),
    ])
    expect(winner?.playerId).toBe('player2')
  })

  it('does not award a letter for an invalid claim', () => {
    let state = startRound(createGame(), 0)
    state = revealNextLetter(state, 3_000, () => 0.99)
    const submitted = submitClaim(state, 'player1', 'NOPE', 3_100)
    const resolved = resolveCurrentLetter(submitted.state, 8_000)
    expect(resolved.players.player1.board).toHaveLength(0)
  })

  it('awards only the displayed letter and stores its lock', () => {
    let state = startRound(createGame(), 0)
    state = revealNextLetter(state, 3_000, () => 0)
    const letter = state.currentLetter?.letter as string
    const validWord = letter === 'E' ? 'EARN' : 'HARD'
    const submitted = submitClaim(state, 'player1', validWord, 3_100)
    const resolved = resolveCurrentLetter(submitted.state, 8_000)
    expect(resolved.players.player1.board.map((tile) => tile.letter)).toEqual([letter])
    expect(resolved.players.player1.positionLocks[letter]).toEqual([1])
  })
})

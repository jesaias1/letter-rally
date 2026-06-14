import { describe, expect, it } from 'vitest'
import {
  activatePowerUp,
  createGame,
  pickClaimWinner,
  resolveCurrentLetter,
  revealNextLetter,
  startRound,
  submitClaim,
  submitFinalWord,
} from '../game/gameEngine'
import type { ClaimAttempt } from '../game/types'
import { boardFrom } from './helpers'

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

  it('penalizes every opponent tile after an instant final-word win', () => {
    const state = startRound(createGame('Winner', 'Opponent'), 0)
    state.status = 'playing'
    state.players.player1.board = boardFrom('SHIRE')
    state.players.player2.board = boardFrom('CRFEEAGD')

    const finished = submitFinalWord(state, 'player1', 'SHIRE', 4_000).state

    expect(finished.winner).toBe('player1')
    expect(finished.players.player1.score).toBe(9)
    expect(finished.players.player2.bestWord).toBeUndefined()
    expect(finished.players.player2.score).toBe(-15)
  })
})

describe('custom rules and power-ups', () => {
  it('uses the configured claim window and round duration', () => {
    const rules = { claimWindowSeconds: 8 as const, roundDurationMinutes: 1 as const, powerUpsEnabled: false }
    const started = startRound(createGame('One', 'Two', rules), 1_000)
    const revealed = revealNextLetter(started, 4_000, () => 0.5)

    expect(started.roundEndsAt).toBe(64_000)
    expect(revealed.currentLetter?.endsAt).toBe(12_000)
  })

  it('allows each power-up once per round', () => {
    const rules = { claimWindowSeconds: 5 as const, roundDurationMinutes: 5 as const, powerUpsEnabled: true }
    const state = startRound(createGame('One', 'Two', rules), 0)
    state.players.player1.board = boardFrom('Q')

    const shielded = activatePowerUp(state, 'player1', 'shield', 1_000)
    const repeated = activatePowerUp(shielded.state, 'player1', 'shield', 1_100)
    const swapped = activatePowerUp(shielded.state, 'player1', 'swap', 1_200, () => 0)

    expect(shielded.result.valid).toBe(true)
    expect(repeated.result.valid).toBe(false)
    expect(swapped.result.valid).toBe(true)
    expect(swapped.state.players.player1.board[0].letter).not.toBe('Q')
  })
})

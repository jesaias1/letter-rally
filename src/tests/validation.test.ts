import { describe, expect, it } from 'vitest'
import { createGame } from '../game/gameEngine'
import { isValidClaimWord, isValidFinalWord } from '../game/validation'
import { boardFrom } from './helpers'

describe('claim validation', () => {
  it('requires the displayed letter', () => {
    const player = createGame().players.player1
    expect(isValidClaimWord('SHOE', 'A', player).reason).toBe('Word must include A.')
  })

  it('requires at least four letters', () => {
    const player = createGame().players.player1
    expect(isValidClaimWord('HAT', 'H', player).valid).toBe(false)
  })

  it('blocks the same letter in the same position', () => {
    const player = createGame().players.player1
    player.positionLocks.H = [2]
    expect(isValidClaimWord('WHIP', 'H', player).valid).toBe(false)
  })

  it('allows the same letter in a different position', () => {
    const player = createGame().players.player1
    player.positionLocks.H = [2]
    const result = isValidClaimWord('HARD', 'H', player)
    expect(result.valid).toBe(true)
    expect(result.lockedPosition).toBe(1)
  })

  it('chooses the first unlocked occurrence', () => {
    const player = createGame().players.player1
    player.positionLocks.A = [1]
    expect(isValidClaimWord('BANANA', 'A', player).lockedPosition).toBe(2)
  })
})

describe('final word validation', () => {
  it('requires at least five letters', () => {
    expect(isValidFinalWord('HAT', boardFrom('HEART')).valid).toBe(false)
  })

  it('accepts a word built from the board', () => {
    expect(isValidFinalWord('HEART', boardFrom('HEART')).valid).toBe(true)
    expect(isValidFinalWord('EARTH', boardFrom('HEART')).valid).toBe(true)
  })

  it('respects duplicate letter counts', () => {
    expect(isValidFinalWord('HEATER', boardFrom('HEART')).valid).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { calculateScore } from '../game/scoring'
import { boardFrom } from './helpers'

describe('scoring', () => {
  it('makes unused rare letters painful', () => {
    const result = calculateScore(boardFrom('QXATE'))
    expect(result.total).toBe(-21)
    expect(result.unusedPenalty).toBe(21)
  })

  it('rewards a valid used word and penalizes leftovers', () => {
    const result = calculateScore(boardFrom('HEARTQ'), 'HEART')
    expect(result.wordValue).toBe(8)
    expect(result.lengthBonus).toBe(1)
    expect(result.unusedPenalty).toBe(10)
    expect(result.total).toBe(-1)
  })
})

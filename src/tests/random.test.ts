import { describe, expect, it } from 'vitest'
import { createSeededRandom, dailySeed } from '../game/random'

describe('seeded randomness', () => {
  it('repeats the same sequence for the same daily seed', () => {
    const first = createSeededRandom('2026-06-14-LETTER-RALLY')
    const second = createSeededRandom('2026-06-14-LETTER-RALLY')
    expect([first(), first(), first()]).toEqual([second(), second(), second()])
  })

  it('formats a date as an ISO daily seed', () => {
    expect(dailySeed(new Date('2026-06-14T12:00:00Z'))).toBe('2026-06-14')
  })
})

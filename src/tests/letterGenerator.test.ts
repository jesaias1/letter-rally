import { describe, expect, it } from 'vitest'
import { drawWeightedLetter } from '../game/letterGenerator'

describe('letter generation', () => {
  it('never repeats the previous letter', () => {
    for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(drawWeightedLetter('E', () => random)).not.toBe('E')
    }
  })

  it('keeps Q, X, and Z below one percent of draws', () => {
    let rareLetters = 0
    for (let index = 0; index < 10_000; index += 1) {
      const letter = drawWeightedLetter(undefined, () => (index + 0.5) / 10_000)
      if ('QXZ'.includes(letter)) rareLetters += 1
    }
    expect(rareLetters).toBeLessThan(100)
  })
})

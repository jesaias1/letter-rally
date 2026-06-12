import { LETTER_VALUES } from '../game/constants'
import type { LetterTile } from '../game/types'

export function boardFrom(word: string): LetterTile[] {
  return [...word].map((letter, index) => ({
    id: `${letter}-${index}`,
    letter,
    value: LETTER_VALUES[letter],
    claimedAt: index,
  }))
}

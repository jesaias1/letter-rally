import { LETTER_WEIGHTS } from './constants'

const weightedLetters = Object.entries(LETTER_WEIGHTS).flatMap(([letter, weight]) =>
  Array.from({ length: weight }, () => letter),
)

export function drawWeightedLetter(random: () => number = Math.random): string {
  const index = Math.floor(random() * weightedLetters.length)
  return weightedLetters[Math.min(index, weightedLetters.length - 1)]
}

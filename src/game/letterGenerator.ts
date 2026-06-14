import { LETTER_WEIGHTS } from './constants'

export function drawWeightedLetter(
  previousLetter?: string,
  random: () => number = Math.random,
): string {
  const choices = Object.entries(LETTER_WEIGHTS).filter(([letter]) => letter !== previousLetter)
  const totalWeight = choices.reduce((total, [, weight]) => total + weight, 0)
  let target = random() * totalWeight

  for (const [letter, weight] of choices) {
    target -= weight
    if (target < 0) return letter
  }

  return choices[choices.length - 1][0]
}

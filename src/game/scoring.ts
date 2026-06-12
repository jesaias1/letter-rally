import { DICTIONARY_WORDS } from '../data/dictionary'
import { LETTER_VALUES, MIN_FINAL_WORD_LENGTH } from './constants'
import type { LetterTile, ScoreResult } from './types'
import { canBuildWord } from './validation'

export function getWordValue(word: string): number {
  return [...word].reduce((total, letter) => total + (LETTER_VALUES[letter] ?? 0), 0)
}

export function calculateScore(board: LetterTile[], word?: string): ScoreResult {
  const boardValue = board.reduce((total, tile) => total + tile.value, 0)

  if (!word) {
    return { total: -boardValue, wordValue: 0, lengthBonus: 0, unusedPenalty: boardValue }
  }

  const wordValue = getWordValue(word)
  const lengthBonus = word.length - 4
  const unusedPenalty = boardValue - wordValue

  return {
    total: wordValue + lengthBonus - unusedPenalty,
    wordValue,
    lengthBonus,
    unusedPenalty,
  }
}

export function findBestFinalWord(board: LetterTile[]): string | undefined {
  if (board.length < MIN_FINAL_WORD_LENGTH) return undefined

  let bestWord: string | undefined
  let bestScore = Number.NEGATIVE_INFINITY

  for (const word of DICTIONARY_WORDS) {
    if (word.length < MIN_FINAL_WORD_LENGTH || word.length > board.length) continue
    if (!canBuildWord(word, board)) continue

    const score = calculateScore(board, word).total
    if (
      score > bestScore ||
      (score === bestScore && word.length > (bestWord?.length ?? 0)) ||
      (score === bestScore && word.length === bestWord?.length && word < bestWord)
    ) {
      bestWord = word
      bestScore = score
    }
  }

  return bestWord
}

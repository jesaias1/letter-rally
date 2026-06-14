import { DICTIONARY_WORDS } from '../data/dictionary'
import { LETTER_VALUES, MIN_FINAL_WORD_LENGTH } from './constants'
import type { LetterTile, ScoreResult } from './types'
import { canBuildWord } from './validation'

export function getWordValue(word: string): number {
  return [...word].reduce((total, letter) => total + (LETTER_VALUES[letter] ?? 0), 0)
}

export function calculateScore(board: LetterTile[], word?: string, shieldedTileId?: string): ScoreResult {
  const boardValue = board.reduce((total, tile) => total + tile.value, 0)
  const shieldValue = board.find((tile) => tile.id === shieldedTileId)?.value ?? 0

  if (!word) {
    const unusedPenalty = Math.max(0, boardValue - shieldValue)
    return { total: -unusedPenalty, wordValue: 0, lengthBonus: 0, unusedPenalty }
  }

  const wordValue = getWordValue(word)
  const lengthBonus = word.length - 4
  const unusedTiles = [...board]
  for (const letter of word) {
    const unshieldedIndex = unusedTiles.findIndex((tile) => tile.letter === letter && tile.id !== shieldedTileId)
    const matchingIndex = unshieldedIndex >= 0 ? unshieldedIndex : unusedTiles.findIndex((tile) => tile.letter === letter)
    if (matchingIndex >= 0) unusedTiles.splice(matchingIndex, 1)
  }
  const unusedPenalty = unusedTiles.reduce(
    (total, tile) => total + (tile.id === shieldedTileId ? 0 : tile.value),
    0,
  )

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

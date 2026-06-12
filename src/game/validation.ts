import { isDictionaryWord } from '../data/dictionary'
import { MIN_CLAIM_WORD_LENGTH, MIN_FINAL_WORD_LENGTH } from './constants'
import type { LetterTile, PlayerState, ValidationResult } from './types'

export function normalizeWord(word: string): string {
  return word.trim().toUpperCase()
}

export function canBuildWord(word: string, board: LetterTile[]): boolean {
  const available = board.reduce<Record<string, number>>((counts, tile) => {
    counts[tile.letter] = (counts[tile.letter] ?? 0) + 1
    return counts
  }, {})

  for (const letter of word) {
    if (!available[letter]) return false
    available[letter] -= 1
  }

  return true
}

export function getAvailableLockPosition(
  word: string,
  displayedLetter: string,
  lockedPositions: number[],
): number | undefined {
  for (let index = 0; index < word.length; index += 1) {
    if (word[index] === displayedLetter && !lockedPositions.includes(index + 1)) {
      return index + 1
    }
  }

  return undefined
}

export function isValidClaimWord(
  word: string,
  displayedLetter: string,
  player: PlayerState,
): ValidationResult {
  const normalizedWord = normalizeWord(word)
  const normalizedLetter = displayedLetter.toUpperCase()

  if (!/^[A-Z]+$/.test(normalizedWord)) {
    return { valid: false, normalizedWord, reason: 'Use letters A-Z only.' }
  }

  if (normalizedWord.length < MIN_CLAIM_WORD_LENGTH) {
    return {
      valid: false,
      normalizedWord,
      reason: `Word must be at least ${MIN_CLAIM_WORD_LENGTH} letters.`,
    }
  }

  if (!normalizedWord.includes(normalizedLetter)) {
    return {
      valid: false,
      normalizedWord,
      reason: `Word must include ${normalizedLetter}.`,
    }
  }

  if (!isDictionaryWord(normalizedWord)) {
    return { valid: false, normalizedWord, reason: 'That is not in the dictionary.' }
  }

  if (player.usedClaimWords.includes(normalizedWord)) {
    return { valid: false, normalizedWord, reason: 'You already used that claim word.' }
  }

  const lockedPositions = player.positionLocks[normalizedLetter] ?? []
  const lockedPosition = getAvailableLockPosition(
    normalizedWord,
    normalizedLetter,
    lockedPositions,
  )

  if (!lockedPosition) {
    const occurrences = [...normalizedWord]
      .map((letter, index) => (letter === normalizedLetter ? index + 1 : 0))
      .filter(Boolean)
      .join(', ')
    return {
      valid: false,
      normalizedWord,
      reason: `${normalizedLetter} position${occurrences.includes(',') ? 's' : ''} ${occurrences} already locked.`,
    }
  }

  return { valid: true, normalizedWord, lockedPosition }
}

export function isValidFinalWord(word: string, board: LetterTile[]): ValidationResult {
  const normalizedWord = normalizeWord(word)

  if (!/^[A-Z]+$/.test(normalizedWord)) {
    return { valid: false, normalizedWord, reason: 'Use letters A-Z only.' }
  }

  if (normalizedWord.length < MIN_FINAL_WORD_LENGTH) {
    return {
      valid: false,
      normalizedWord,
      reason: `Final word must be at least ${MIN_FINAL_WORD_LENGTH} letters.`,
    }
  }

  if (!canBuildWord(normalizedWord, board)) {
    return {
      valid: false,
      normalizedWord,
      reason: `You do not have the letters for ${normalizedWord}.`,
    }
  }

  if (!isDictionaryWord(normalizedWord)) {
    return { valid: false, normalizedWord, reason: 'That is not in the dictionary.' }
  }

  return { valid: true, normalizedWord }
}

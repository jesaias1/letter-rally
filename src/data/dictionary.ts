import englishWords from 'an-array-of-english-words'

const alphabeticWords = (englishWords as string[])
  .map((word) => word.toUpperCase())
  .filter((word) => /^[A-Z]+$/.test(word))

export const DICTIONARY_WORDS = [...new Set(alphabeticWords)]
export const DICTIONARY = new Set(DICTIONARY_WORDS)

export function isDictionaryWord(word: string): boolean {
  return DICTIONARY.has(word)
}

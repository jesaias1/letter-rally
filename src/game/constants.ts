export const CLAIM_WINDOW_MS = 5_000
export const ROUND_LENGTH_MS = 5 * 60_000
export const START_COUNTDOWN_MS = 3_000
export const LETTER_RESOLUTION_MS = 1_150
export const MIN_CLAIM_WORD_LENGTH = 4
export const MIN_FINAL_WORD_LENGTH = 5
export const TIE_THRESHOLD_MS = 15

export const LETTER_VALUES: Record<string, number> = {
  A: 1,
  B: 3,
  C: 3,
  D: 2,
  E: 1,
  F: 4,
  G: 2,
  H: 4,
  I: 1,
  J: 8,
  K: 5,
  L: 1,
  M: 3,
  N: 1,
  O: 1,
  P: 3,
  Q: 10,
  R: 1,
  S: 1,
  T: 1,
  U: 1,
  V: 4,
  W: 4,
  X: 8,
  Y: 4,
  Z: 10,
}

export const LETTER_WEIGHTS: Record<string, number> = {
  E: 12,
  A: 9,
  I: 9,
  O: 8,
  N: 6,
  R: 6,
  T: 6,
  L: 4,
  S: 4,
  U: 4,
  D: 4,
  G: 3,
  B: 2,
  C: 2,
  M: 2,
  P: 2,
  F: 2,
  H: 2,
  V: 1,
  W: 1,
  Y: 1,
  K: 1,
  J: 0.35,
  X: 0.18,
  Q: 0.12,
  Z: 0.1,
}

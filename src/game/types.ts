import type { GameRules } from './rules'

export type PlayerId = 'player1' | 'player2'

export type GameStatus =
  | 'idle'
  | 'countdown'
  | 'playing'
  | 'letterResolution'
  | 'roundOver'

export type WinReason = 'finalWord' | 'score' | 'draw' | 'forfeit'

export interface LetterTile {
  id: string
  letter: string
  value: number
  claimedAt: number
}

export type PositionLocks = Record<string, number[]>

export interface PlayerState {
  id: PlayerId
  name: string
  board: LetterTile[]
  positionLocks: PositionLocks
  usedClaimWords: string[]
  submittedFinalWord?: string
  bestWord?: string
  score: number
  powerUps: {
    swapAvailable: boolean
    shieldAvailable: boolean
    shieldedTileId?: string
  }
}

export interface ClaimAttempt {
  playerId: PlayerId
  word: string
  normalizedWord: string
  submittedAt: number
  valid: boolean
  reason?: string
  lockedPosition?: number
}

export interface CurrentLetterState {
  id: string
  letter: string
  startedAt: number
  endsAt: number
  claims: ClaimAttempt[]
  resolved: boolean
}

export interface GameLogEntry {
  id: string
  time: number
  type: 'system' | 'letter' | 'claim' | 'reject' | 'win'
  message: string
}

export interface GameState {
  rules: GameRules
  status: GameStatus
  players: Record<PlayerId, PlayerState>
  currentLetter?: CurrentLetterState
  countdownEndsAt?: number
  roundStartedAt?: number
  roundEndsAt?: number
  nextLetterAt?: number
  winner?: PlayerId
  winReason?: WinReason
  winningWord?: string
  resultMessage?: string
  log: GameLogEntry[]
}

export type PowerUpKind = 'swap' | 'shield'

export interface ValidationResult {
  valid: boolean
  normalizedWord: string
  reason?: string
  lockedPosition?: number
}

export interface ScoreResult {
  total: number
  wordValue: number
  lengthBonus: number
  unusedPenalty: number
}

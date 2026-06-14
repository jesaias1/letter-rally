export type ClaimWindowSeconds = 3 | 5 | 8
export type RoundDurationMinutes = 1 | 3 | 5

export interface GameRules {
  claimWindowSeconds: ClaimWindowSeconds
  roundDurationMinutes: RoundDurationMinutes
  powerUpsEnabled: boolean
}

export const DEFAULT_GAME_RULES: GameRules = {
  claimWindowSeconds: 5,
  roundDurationMinutes: 5,
  powerUpsEnabled: false,
}

export function claimWindowMs(rules: GameRules): number {
  return rules.claimWindowSeconds * 1_000
}

export function roundDurationMs(rules: GameRules): number {
  return rules.roundDurationMinutes * 60_000
}

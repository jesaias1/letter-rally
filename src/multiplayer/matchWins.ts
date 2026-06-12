import type { PlayerId } from '../game/types'
import type { MatchWins } from './types'

export const INITIAL_MATCH_WINS: MatchWins = { player1: 0, player2: 0 }

export function recordMatchWin(matchWins: MatchWins, winner?: PlayerId): MatchWins {
  if (!winner) return matchWins
  return { ...matchWins, [winner]: matchWins[winner] + 1 }
}

import type { PlayerId } from '../game/types'
import type { BotDifficulty } from './bot'

export interface BotRecord {
  wins: number
  losses: number
  draws: number
}

export type BotRecords = Record<BotDifficulty, BotRecord>

export const EMPTY_BOT_RECORDS: BotRecords = {
  easy: { wins: 0, losses: 0, draws: 0 },
  medium: { wins: 0, losses: 0, draws: 0 },
  hard: { wins: 0, losses: 0, draws: 0 },
}

const STORAGE_KEY = 'letter-rally-bot-records'

export function recordBotResult(
  records: BotRecords,
  difficulty: BotDifficulty,
  winner?: PlayerId,
): BotRecords {
  const result = winner === 'player1' ? 'wins' : winner === 'player2' ? 'losses' : 'draws'
  return {
    ...records,
    [difficulty]: {
      ...records[difficulty],
      [result]: records[difficulty][result] + 1,
    },
  }
}

export function loadBotRecords(): BotRecords {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return EMPTY_BOT_RECORDS
    const parsed = JSON.parse(stored) as Partial<BotRecords>
    return {
      easy: { ...EMPTY_BOT_RECORDS.easy, ...parsed.easy },
      medium: { ...EMPTY_BOT_RECORDS.medium, ...parsed.medium },
      hard: { ...EMPTY_BOT_RECORDS.hard, ...parsed.hard },
    }
  } catch {
    return EMPTY_BOT_RECORDS
  }
}

export function saveBotRecords(records: BotRecords): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

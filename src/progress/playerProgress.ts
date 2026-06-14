export interface PlayerStatistics {
  seriesPlayed: number
  seriesWon: number
  seriesLost: number
  seriesDrawn: number
  roundsWon: number
  validClaims: number
  finalWords: number
  powerUpsUsed: number
  dailyChallenges: number
  bestSeriesScore: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  unlocked: boolean
}

export const EMPTY_STATISTICS: PlayerStatistics = {
  seriesPlayed: 0,
  seriesWon: 0,
  seriesLost: 0,
  seriesDrawn: 0,
  roundsWon: 0,
  validClaims: 0,
  finalWords: 0,
  powerUpsUsed: 0,
  dailyChallenges: 0,
  bestSeriesScore: 0,
}

const STORAGE_KEY = 'letter-rally-player-statistics'

export function loadStatistics(): PlayerStatistics {
  try {
    return { ...EMPTY_STATISTICS, ...JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return EMPTY_STATISTICS
  }
}

export function saveStatistics(statistics: PlayerStatistics): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(statistics))
}

export function getAchievements(statistics: PlayerStatistics): Achievement[] {
  return [
    { id: 'first-series', title: 'First Rally', description: 'Complete a series.', unlocked: statistics.seriesPlayed >= 1 },
    { id: 'first-win', title: 'Series Champion', description: 'Win a cumulative-score series.', unlocked: statistics.seriesWon >= 1 },
    { id: 'claim-25', title: 'Quick Draw', description: 'Lock 25 valid claims.', unlocked: statistics.validClaims >= 25 },
    { id: 'finisher-5', title: 'Wordsmith', description: 'Submit 5 winning final words.', unlocked: statistics.finalWords >= 5 },
    { id: 'power-user', title: 'Powered Up', description: 'Use 10 swaps or shields.', unlocked: statistics.powerUpsUsed >= 10 },
    { id: 'daily-7', title: 'Daily Habit', description: 'Complete 7 daily challenges.', unlocked: statistics.dailyChallenges >= 7 },
    { id: 'score-50', title: 'High Voltage', description: 'Score 50 points in one series.', unlocked: statistics.bestSeriesScore >= 50 },
  ]
}

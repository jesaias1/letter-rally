import type { SeriesState } from './series'
import type { GameState } from './types'
import { hydrateGameState } from './stateCompatibility'

export interface ReplayFrame {
  capturedAt: number
  game: GameState
  series: SeriesState
}

export interface SavedReplay {
  id: string
  createdAt: number
  label: string
  frames: ReplayFrame[]
}

const STORAGE_KEY = 'letter-rally-replays'

export function loadReplays(): SavedReplay[] {
  try {
    const replays = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as SavedReplay[]
    return replays.map((replay) => ({
      ...replay,
      frames: replay.frames.map((frame) => ({ ...frame, game: hydrateGameState(frame.game) })),
    }))
  } catch {
    return []
  }
}

export function saveReplay(replay: SavedReplay): SavedReplay[] {
  const replays = [replay, ...loadReplays()].slice(0, 10)
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(replays))
  return replays
}

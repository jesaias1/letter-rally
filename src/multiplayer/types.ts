import type { GameState, PlayerId } from '../game/types'
import type { SeriesState } from '../game/series'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface RoomSession {
  roomCode: string
  clientId: string
  playerName: string
  role: 'host' | 'guest'
}

export interface PlayerFeedback {
  letterId?: string
  message: string
  tone: 'neutral' | 'success' | 'error'
}

export type PlayerAction =
  | { kind: 'claim'; word: string }
  | { kind: 'finalWord'; word: string }
  | { kind: 'playAgain' }

export interface StatePayload {
  game: GameState
  series: SeriesState
  revision: number
  hostId: string
}

export interface JoinRequestPayload {
  clientId: string
  playerName: string
}

export interface AssignmentPayload {
  clientId: string
  playerId: PlayerId
  hostId: string
}

export interface ActionPayload {
  clientId: string
  playerId: PlayerId
  action: PlayerAction
}

export interface ActionResultPayload {
  clientId: string
  feedback: PlayerFeedback
}

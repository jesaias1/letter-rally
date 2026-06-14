import { DEFAULT_GAME_RULES } from './rules'
import type { GameState, PlayerId } from './types'

export function hydrateGameState(game: GameState): GameState {
  const players = { ...game.players }
  for (const playerId of ['player1', 'player2'] as PlayerId[]) {
    players[playerId] = {
      ...players[playerId],
      powerUps: players[playerId].powerUps ?? {
        swapAvailable: true,
        shieldAvailable: true,
      },
    }
  }
  return { ...game, rules: game.rules ?? DEFAULT_GAME_RULES, players }
}

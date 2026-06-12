import { describe, expect, it } from 'vitest'
import { ROUND_LENGTH_MS } from '../game/constants'
import { createGame, startRound } from '../game/gameEngine'
import { createRoomCode, normalizeRoomCode } from '../multiplayer/roomCode'

describe('online rooms', () => {
  it('creates invite-safe room codes', () => {
    const roomCode = createRoomCode()
    expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })

  it('normalizes room codes from invite URLs', () => {
    expect(normalizeRoomCode('ab-cd 234')).toBe('ABCD23')
  })

  it('runs online matches for five minutes', () => {
    const state = startRound(createGame(), 1_000)
    expect(ROUND_LENGTH_MS).toBe(300_000)
    expect((state.roundEndsAt ?? 0) - (state.roundStartedAt ?? 0)).toBe(300_000)
  })
})

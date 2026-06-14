import { describe, expect, it } from 'vitest'
import { createGame } from '../game/gameEngine'
import { isValidClaimWord } from '../game/validation'
import {
  chooseBotClaimWord,
  chooseBotFinalWord,
  getBotReactionDelay,
} from '../singleplayer/bot'
import { EMPTY_BOT_RECORDS, recordBotResult } from '../singleplayer/records'
import { boardFrom } from './helpers'

describe('single-player bot', () => {
  it('reacts progressively faster as difficulty increases', () => {
    expect(getBotReactionDelay('easy', () => 0)).toBe(3_100)
    expect(getBotReactionDelay('medium', () => 0)).toBe(1_550)
    expect(getBotReactionDelay('hard', () => 0)).toBe(480)
  })

  it('chooses a legal claim through the normal game validator', () => {
    const bot = createGame().players.player2
    const word = chooseBotClaimWord('E', bot, 'hard', () => 0)

    expect(word).toBeDefined()
    expect(isValidClaimWord(word ?? '', 'E', bot).valid).toBe(true)
  })

  it('allows the easy bot to miss a rally', () => {
    const bot = createGame().players.player2
    expect(chooseBotClaimWord('E', bot, 'easy', () => 0.99)).toBeUndefined()
  })

  it('builds finishers from the curated common vocabulary', () => {
    expect(chooseBotFinalWord(boardFrom('SHOCK'))).toBe('SHOCK')
  })
})

describe('bot records', () => {
  it('tracks wins, losses, and draws separately per difficulty', () => {
    const afterWin = recordBotResult(EMPTY_BOT_RECORDS, 'medium', 'player1')
    const afterLoss = recordBotResult(afterWin, 'medium', 'player2')
    const afterDraw = recordBotResult(afterLoss, 'medium')

    expect(afterDraw.medium).toEqual({ wins: 1, losses: 1, draws: 1 })
    expect(afterDraw.easy).toEqual({ wins: 0, losses: 0, draws: 0 })
  })
})

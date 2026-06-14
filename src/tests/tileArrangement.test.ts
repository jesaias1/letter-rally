import { describe, expect, it } from 'vitest'
import { arrangeTiles, shuffleTiles } from '../game/tileArrangement'
import { boardFrom } from './helpers'

describe('tile arrangement', () => {
  it('reorders tiles without changing the board contents', () => {
    const board = boardFrom('HEART')
    const shuffled = shuffleTiles(board, () => 0)

    expect(shuffled.map((tile) => tile.letter)).not.toEqual(board.map((tile) => tile.letter))
    expect(shuffled.map((tile) => tile.id).sort()).toEqual(board.map((tile) => tile.id).sort())
  })

  it('keeps newly claimed tiles after the chosen local order', () => {
    const board = boardFrom('HEART')
    const order = [board[2].id, board[0].id, board[1].id]

    expect(arrangeTiles(board, order).map((tile) => tile.letter)).toEqual(['A', 'H', 'E', 'R', 'T'])
  })
})

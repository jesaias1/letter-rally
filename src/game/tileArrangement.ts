import type { LetterTile } from './types'

export function arrangeTiles(board: LetterTile[], tileOrder: string[]): LetterTile[] {
  const order = new Map(tileOrder.map((tileId, index) => [tileId, index]))

  return [...board].sort((left, right) => {
    const leftIndex = order.get(left.id)
    const rightIndex = order.get(right.id)

    if (leftIndex === undefined && rightIndex === undefined) return 0
    if (leftIndex === undefined) return 1
    if (rightIndex === undefined) return -1
    return leftIndex - rightIndex
  })
}

export function shuffleTiles(
  tiles: LetterTile[],
  random: () => number = Math.random,
): LetterTile[] {
  const shuffled = [...tiles]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  if (
    shuffled.length > 1 &&
    shuffled.every((tile, index) => tile.id === tiles[index]?.id)
  ) {
    shuffled.push(shuffled.shift() as LetterTile)
  }

  return shuffled
}

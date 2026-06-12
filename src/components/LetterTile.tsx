import type { LetterTile as LetterTileData } from '../game/types'

interface LetterTileProps {
  tile: LetterTileData
  side: 'left' | 'right'
}

export function LetterTile({ tile, side }: LetterTileProps) {
  return <span className={`letter-tile letter-tile--${side}`} title={`${tile.letter}: ${tile.value} points`}><strong>{tile.letter}</strong><small>{tile.value}</small></span>
}

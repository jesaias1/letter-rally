import type { LetterTile as LetterTileData } from '../game/types'

interface LetterTileProps {
  tile: LetterTileData
  side: 'left' | 'right'
  shielded?: boolean
}

export function LetterTile({ tile, side, shielded = false }: LetterTileProps) {
  return <span className={`letter-tile letter-tile--${side}${shielded ? ' letter-tile--shielded' : ''}`} title={`${tile.letter}: ${tile.value} points${shielded ? ', penalty shielded' : ''}`}><strong>{tile.letter}</strong><small>{tile.value}</small>{shielded && <i aria-label="Shielded">S</i>}</span>
}

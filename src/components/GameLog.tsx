import type { GameLogEntry } from '../game/types'

interface GameLogProps { entries: GameLogEntry[] }

export function GameLog({ entries }: GameLogProps) {
  return <aside className="game-log"><div className="game-log__heading"><span>LIVE FEED</span><i /></div><ol>{[...entries].reverse().slice(0, 5).map((entry) => <li key={entry.id} className={`game-log__entry game-log__entry--${entry.type}`}><time>{new Date(entry.time).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}</time><span>{entry.message}</span></li>)}</ol></aside>
}

import { useState } from 'react'
import type { SavedReplay } from '../game/replay'
import { GameView } from './GameView'

interface ReplayViewerProps {
  replay: SavedReplay
  onClose: () => void
}

export function ReplayViewer({ replay, onClose }: ReplayViewerProps) {
  const [frameIndex, setFrameIndex] = useState(0)
  const frame = replay.frames[frameIndex]

  return (
    <div className="replay-shell">
      <div className="replay-controls">
        <button type="button" onClick={onClose}>EXIT REPLAY</button>
        <strong>{replay.label}</strong>
        <button type="button" disabled={frameIndex === 0} onClick={() => setFrameIndex((current) => current - 1)}>PREVIOUS</button>
        <span>{frameIndex + 1} / {replay.frames.length}</span>
        <button type="button" disabled={frameIndex === replay.frames.length - 1} onClick={() => setFrameIndex((current) => current + 1)}>NEXT</button>
      </div>
      <GameView game={frame.game} now={frame.capturedAt} localPlayerId="player1" feedback={{ player1: { message: 'Replay mode', tone: 'neutral' }, player2: { message: 'Replay mode', tone: 'neutral' } }} series={frame.series} modeLabel="MATCH REPLAY" canPlayAgain={false} interactive={false} soundEnabled={false} onClaim={() => undefined} onFinalWord={() => undefined} onPowerUp={() => undefined} onReportWord={() => undefined} onPlayAgain={() => undefined} onLeave={onClose} />
    </div>
  )
}

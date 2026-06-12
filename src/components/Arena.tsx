import { CLAIM_WINDOW_MS, LETTER_VALUES } from '../game/constants'
import type { CurrentLetterState, GameState, PlayerId, PlayerState } from '../game/types'

interface ArenaProps {
  countdown?: number
  currentLetter?: CurrentLetterState
  gameStatus: GameState['status']
  now: number
  resultMessage?: string
  players: Record<PlayerId, PlayerState>
}

export function Arena({ countdown, currentLetter, gameStatus, now, resultMessage, players }: ArenaProps) {
  const remaining = currentLetter ? Math.max(0, currentLetter.endsAt - now) : 0
  const progress = currentLetter ? (remaining / CLAIM_WINDOW_MS) * 100 : 0
  const validClaims = currentLetter?.claims.filter((claim) => claim.valid) ?? []

  return (
    <section className="arena" aria-live="polite">
      <div className="arena__rail arena__rail--top"><span>CLAIM WINDOW</span><strong>{gameStatus === 'playing' ? `${(remaining / 1_000).toFixed(1)}s` : '—'}</strong></div>
      <div className={`letter-stage letter-stage--${gameStatus}`}>
        <div className="letter-stage__orbit" />
        {countdown ? (
          <div className="countdown-number" key={countdown}>{countdown}</div>
        ) : currentLetter ? (
          <>
            <span className="letter-stage__value">{LETTER_VALUES[currentLetter.letter]} PTS</span>
            <strong className="letter-stage__letter" key={currentLetter.id}>{currentLetter.letter}</strong>
            <span className="letter-stage__prompt">{gameStatus === 'playing' ? 'TYPE A WORD CONTAINING IT' : resultMessage}</span>
          </>
        ) : <strong className="letter-stage__letter">•</strong>}
      </div>
      <div className="claim-meter" aria-label="Claim time remaining"><span style={{ width: `${progress}%` }} /></div>
      <div className="claim-statuses">
        {(['player1', 'player2'] as PlayerId[]).map((playerId) => {
          const locked = validClaims.some((claim) => claim.playerId === playerId)
          return <span className={locked ? 'claim-status claim-status--locked' : 'claim-status'} key={playerId}><i />{players[playerId].name}: {locked ? 'LOCKED' : 'WAITING'}</span>
        })}
      </div>
    </section>
  )
}

import type { GameState, PlayerId } from '../game/types'
import type { MatchWins, PlayerFeedback } from '../multiplayer/types'
import { Arena } from './Arena'
import { GameLog } from './GameLog'
import { PlayerPanel } from './PlayerPanel'
import { RoundOverModal } from './RoundOverModal'

const PLAYER_IDS: PlayerId[] = ['player1', 'player2']

interface GameViewProps {
  game: GameState
  now: number
  localPlayerId: PlayerId
  feedback: Record<PlayerId, PlayerFeedback>
  matchWins: MatchWins
  modeLabel: string
  canPlayAgain: boolean
  onClaim: (word: string) => void
  onFinalWord: (word: string) => void
  onPlayAgain: () => void
  onLeave: () => void
}

export function GameView({ game, now, localPlayerId, feedback, matchWins, modeLabel, canPlayAgain, onClaim, onFinalWord, onPlayAgain, onLeave }: GameViewProps) {
  const roundRemainingMs = Math.max(0, (game.roundEndsAt ?? now) - now)
  const countdown = game.status === 'countdown'
    ? Math.max(1, Math.ceil(((game.countdownEndsAt ?? now) - now) / 1_000))
    : undefined

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">LR</span>
          <div><p className="eyebrow">{modeLabel}</p><h1>Letter Rally</h1></div>
        </div>
        <div className="topbar-actions">
          <button className="leave-button" type="button" onClick={onLeave}>LEAVE MATCH</button>
          <div className="round-clock" aria-label="Round time remaining">
            <span className="round-clock__label">ROUND</span>
            <strong>{formatTime(roundRemainingMs)}</strong>
          </div>
        </div>
        <div className={`status-pill status-pill--${game.status}`}><span className="status-dot" />{statusLabel(game.status)}</div>
      </header>

      <section className="duel-grid">
        <PlayerPanel key={`player1-${game.roundStartedAt}`} side="left" player={game.players.player1} currentLetter={game.currentLetter} gameStatus={game.status} feedback={feedback.player1} isLocalPlayer={localPlayerId === 'player1'} wins={matchWins.player1} onClaim={onClaim} onFinalWord={onFinalWord} />
        <Arena countdown={countdown} currentLetter={game.currentLetter} gameStatus={game.status} now={now} resultMessage={game.resultMessage} players={game.players} />
        <PlayerPanel key={`player2-${game.roundStartedAt}`} side="right" player={game.players.player2} currentLetter={game.currentLetter} gameStatus={game.status} feedback={feedback.player2} isLocalPlayer={localPlayerId === 'player2'} wins={matchWins.player2} onClaim={onClaim} onFinalWord={onFinalWord} />
      </section>

      <section className="lower-deck">
        <div className="rule-card"><span className="rule-card__number">01</span><div><strong>Claim the center letter</strong><p>Enter a 4+ letter dictionary word containing it.</p></div></div>
        <div className="rule-card"><span className="rule-card__number">02</span><div><strong>Mind your position locks</strong><p>Reuse the letter, but never in the same word position.</p></div></div>
        <div className="rule-card"><span className="rule-card__number">03</span><div><strong>Build a 5+ letter finisher</strong><p>Use only your tiles. First valid final word wins.</p></div></div>
        <GameLog entries={game.log} />
      </section>

      {game.status === 'roundOver' && <RoundOverModal game={game} playerIds={PLAYER_IDS} canPlayAgain={canPlayAgain} matchWins={matchWins} onPlayAgain={onPlayAgain} onLeave={onLeave} />}
    </main>
  )
}

function formatTime(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1_000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function statusLabel(status: GameState['status']): string {
  if (status === 'countdown') return 'Get ready'
  if (status === 'playing') return 'Letter live'
  if (status === 'letterResolution') return 'Resolving'
  if (status === 'roundOver') return 'Round over'
  return 'Room open'
}

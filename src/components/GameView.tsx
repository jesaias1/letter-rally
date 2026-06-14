import type { GameState, PlayerId } from '../game/types'
import type { SeriesState } from '../game/series'
import type { PlayerFeedback } from '../multiplayer/types'
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
  series: SeriesState
  modeLabel: string
  canPlayAgain: boolean
  onClaim: (word: string) => void
  onFinalWord: (word: string) => void
  onPlayAgain: () => void
  onLeave: () => void
}

export function GameView({ game, now, localPlayerId, feedback, series, modeLabel, canPlayAgain, onClaim, onFinalWord, onPlayAgain, onLeave }: GameViewProps) {
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
        <div className="series-readout" key={series.roundsPlayed}>
          <span>ROUND {Math.min(series.roundsPlayed + 1, series.roundsToPlay)} / {series.roundsToPlay}</span>
          <strong>{formatSigned(series.totalScore.player1)} : {formatSigned(series.totalScore.player2)}</strong>
        </div>
      </header>

      <section className="duel-grid">
        <PlayerPanel key={`player1-${game.roundStartedAt}`} side="left" player={game.players.player1} currentLetter={game.currentLetter} gameStatus={game.status} feedback={feedback.player1} isLocalPlayer={localPlayerId === 'player1'} wins={series.roundWins.player1} onClaim={onClaim} onFinalWord={onFinalWord} />
        <Arena countdown={countdown} currentLetter={game.currentLetter} gameStatus={game.status} now={now} resultMessage={game.resultMessage} players={game.players} />
        <PlayerPanel key={`player2-${game.roundStartedAt}`} side="right" player={game.players.player2} currentLetter={game.currentLetter} gameStatus={game.status} feedback={feedback.player2} isLocalPlayer={localPlayerId === 'player2'} wins={series.roundWins.player2} onClaim={onClaim} onFinalWord={onFinalWord} />
      </section>

      <section className="lower-deck">
        <div className="rule-card"><span className="rule-card__number">01</span><div><strong>Claim the center letter</strong><p>Enter a 4+ letter dictionary word containing it.</p></div></div>
        <div className="rule-card"><span className="rule-card__number">02</span><div><strong>Mind your position locks</strong><p>Reuse the letter, but never in the same word position.</p></div></div>
        <div className="rule-card"><span className="rule-card__number">03</span><div><strong>Build a 5+ letter finisher</strong><p>Use only your tiles. First valid final word wins.</p></div></div>
        <GameLog entries={game.log} />
      </section>

      {game.status === 'roundOver' && <RoundOverModal game={game} playerIds={PLAYER_IDS} canPlayAgain={canPlayAgain} series={series} onPlayAgain={onPlayAgain} onLeave={onLeave} />}
    </main>
  )
}

function formatSigned(score: number): string {
  return score > 0 ? `+${score}` : String(score)
}

function formatTime(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1_000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

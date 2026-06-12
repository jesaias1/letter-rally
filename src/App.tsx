import { Arena } from './components/Arena'
import { ConfigurationScreen } from './components/ConfigurationScreen'
import { GameLog } from './components/GameLog'
import { PlayerPanel } from './components/PlayerPanel'
import { RoundOverModal } from './components/RoundOverModal'
import { StartScreen } from './components/StartScreen'
import { WaitingRoom } from './components/WaitingRoom'
import type { GameState, PlayerId } from './game/types'
import { useMultiplayerGame } from './multiplayer/useMultiplayerGame'
import './styles/game.css'

const PLAYER_IDS: PlayerId[] = ['player1', 'player2']

export function App() {
  const multiplayer = useMultiplayerGame()

  if (multiplayer.configurationError) {
    return <ConfigurationScreen message={multiplayer.configurationError} />
  }

  if (!multiplayer.session) {
    return (
      <StartScreen
        mode={multiplayer.invitedRoomCode ? 'join' : 'create'}
        roomCode={multiplayer.invitedRoomCode}
        error={multiplayer.roomError}
        onSubmit={multiplayer.invitedRoomCode ? multiplayer.joinRoom : multiplayer.createRoom}
      />
    )
  }

  if (multiplayer.game.status === 'idle') {
    return (
      <WaitingRoom
        connectionStatus={multiplayer.connectionStatus}
        connectedPlayers={multiplayer.connectedPlayers}
        error={multiplayer.roomError}
        inviteUrl={multiplayer.inviteUrl ?? ''}
        isHost={multiplayer.session.role === 'host'}
        roomCode={multiplayer.session.roomCode}
      />
    )
  }

  const { game, now, localPlayerId } = multiplayer
  const roundRemainingMs = Math.max(0, (game.roundEndsAt ?? now) - now)
  const countdown =
    game.status === 'countdown'
      ? Math.max(1, Math.ceil(((game.countdownEndsAt ?? now) - now) / 1_000))
      : undefined

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">LR</span>
          <div>
            <p className="eyebrow">ONLINE ROOM · {multiplayer.session.roomCode}</p>
            <h1>Letter Rally</h1>
          </div>
        </div>
        <div className="round-clock" aria-label="Round time remaining">
          <span className="round-clock__label">ROUND</span>
          <strong>{formatTime(roundRemainingMs)}</strong>
        </div>
        <div className={`status-pill status-pill--${game.status}`}>
          <span className="status-dot" />
          {statusLabel(game.status)}
        </div>
      </header>

      <section className="duel-grid">
        <PlayerPanel
          side="left"
          player={game.players.player1}
          currentLetter={game.currentLetter}
          gameStatus={game.status}
          feedback={multiplayer.feedback.player1}
          isLocalPlayer={localPlayerId === 'player1'}
          onClaim={multiplayer.submitClaim}
          onFinalWord={multiplayer.submitFinalWord}
        />

        <Arena
          countdown={countdown}
          currentLetter={game.currentLetter}
          gameStatus={game.status}
          now={now}
          resultMessage={game.resultMessage}
          players={game.players}
        />

        <PlayerPanel
          side="right"
          player={game.players.player2}
          currentLetter={game.currentLetter}
          gameStatus={game.status}
          feedback={multiplayer.feedback.player2}
          isLocalPlayer={localPlayerId === 'player2'}
          onClaim={multiplayer.submitClaim}
          onFinalWord={multiplayer.submitFinalWord}
        />
      </section>

      <section className="lower-deck">
        <div className="rule-card">
          <span className="rule-card__number">01</span>
          <div><strong>Claim the center letter</strong><p>Enter a 4+ letter dictionary word containing it.</p></div>
        </div>
        <div className="rule-card">
          <span className="rule-card__number">02</span>
          <div><strong>Mind your position locks</strong><p>Reuse the letter, but never in the same word position.</p></div>
        </div>
        <div className="rule-card">
          <span className="rule-card__number">03</span>
          <div><strong>Build a 5+ letter finisher</strong><p>Use only your tiles. First valid final word wins.</p></div>
        </div>
        <GameLog entries={game.log} />
      </section>

      {game.status === 'roundOver' && (
        <RoundOverModal
          game={game}
          playerIds={PLAYER_IDS}
          canPlayAgain={multiplayer.session.role === 'host'}
          onPlayAgain={multiplayer.playAgain}
        />
      )}
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

import { useState, type FormEvent } from 'react'
import type { BotDifficulty } from '../singleplayer/bot'
import type { BotRecords } from '../singleplayer/records'

interface StartScreenProps {
  mode: 'menu' | 'join'
  roomCode?: string
  error?: string
  botRecords: BotRecords
  onCreateRoom: (playerName: string) => void
  onJoinRoom: (playerName: string) => void
  onStartBot: (playerName: string, difficulty: BotDifficulty) => void
}

const DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard']

export function StartScreen({ mode, roomCode, error, botRecords, onCreateRoom, onJoinRoom, onStartBot }: StartScreenProps) {
  const [playerName, setPlayerName] = useState(() => window.localStorage.getItem('letter-rally-player-name') ?? '')
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium')
  const joining = mode === 'join'

  function rememberName(): string {
    const name = playerName.trim() || 'Player One'
    window.localStorage.setItem('letter-rally-player-name', name)
    return name
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = rememberName()
    if (joining) onJoinRoom(name)
    else onStartBot(name, difficulty)
  }

  return (
    <main className="start-screen">
      <div className="start-screen__noise" />
      <section className="start-card">
        <div className="start-card__brand"><span className="brand-mark brand-mark--large">LR</span><p className="eyebrow">A REAL-TIME WORD DUEL</p></div>
        <div className="start-card__hero">
          <h1>LETTER<span>RALLY</span></h1>
          <p>{joining ? `You were invited to room ${roomCode}. Choose your name and enter the rally.` : 'Play instantly against a bot or create a private link for a live duel with a friend.'}</p>
        </div>
        <form className="player-setup player-setup--online" onSubmit={handleSubmit}>
          <label>
            <span>YOUR NAME</span>
            <input autoFocus maxLength={18} placeholder={joining ? 'PLAYER TWO' : 'PLAYER ONE'} value={playerName} onChange={(event) => setPlayerName(event.target.value)} aria-label="Your player name" />
          </label>
          {!joining && (
            <fieldset className="difficulty-picker">
              <legend>BOT DIFFICULTY</legend>
              <div>
                {DIFFICULTIES.map((option) => (
                  <button className={difficulty === option ? 'difficulty-option difficulty-option--active' : 'difficulty-option'} key={option} type="button" aria-pressed={difficulty === option} onClick={() => setDifficulty(option)}>
                    <strong>{option}</strong>
                    <span>{botRecords[option].wins}W {botRecords[option].losses}L {botRecords[option].draws}D</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {error && <p className="setup-error">{error}</p>}
          <button className="primary-button primary-button--start" type="submit">{joining ? 'JOIN THE RALLY' : `PLAY ${difficulty.toUpperCase()} BOT`} <span aria-hidden="true">-&gt;</span></button>
          {!joining && <button className="secondary-button" type="button" onClick={() => onCreateRoom(rememberName())}>CREATE ONLINE ROOM</button>}
        </form>
        <div className="start-rules" aria-label="Game summary">
          <span><strong>5 SEC</strong> to claim</span>
          <span><strong>5 MIN</strong> per match</span>
          <span><strong>3 LEVELS</strong> bot difficulty</span>
          <span><strong>NO LOGIN</strong> online invite links</span>
        </div>
      </section>
    </main>
  )
}

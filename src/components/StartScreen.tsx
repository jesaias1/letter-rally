import { useState, type FormEvent } from 'react'

interface StartScreenProps {
  mode: 'create' | 'join'
  roomCode?: string
  error?: string
  onSubmit: (playerName: string) => void
}

export function StartScreen({ mode, roomCode, error, onSubmit }: StartScreenProps) {
  const [playerName, setPlayerName] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(playerName)
  }

  const joining = mode === 'join'

  return (
    <main className="start-screen">
      <div className="start-screen__noise" />
      <section className="start-card">
        <div className="start-card__brand">
          <span className="brand-mark brand-mark--large">LR</span>
          <p className="eyebrow">A REAL-TIME WORD DUEL</p>
        </div>
        <div className="start-card__hero">
          <h1>LETTER<span>RALLY</span></h1>
          <p>{joining ? `You were invited to room ${roomCode}. Choose your name and enter the rally.` : 'Create a private invite link, send it to a friend, and fight for every letter live.'}</p>
        </div>
        <form className="player-setup player-setup--online" onSubmit={handleSubmit}>
          <label>
            <span>YOUR NAME</span>
            <input autoFocus maxLength={18} placeholder={joining ? 'PLAYER TWO' : 'PLAYER ONE'} value={playerName} onChange={(event) => setPlayerName(event.target.value)} aria-label="Your player name" />
          </label>
          {error && <p className="setup-error">{error}</p>}
          <button className="primary-button primary-button--start" type="submit">
            {joining ? 'JOIN THE RALLY' : 'CREATE PRIVATE ROOM'} <span aria-hidden="true">→</span>
          </button>
        </form>
        <div className="start-rules" aria-label="Game summary">
          <span><strong>5 SEC</strong> to claim</span>
          <span><strong>5 MIN</strong> per match</span>
          <span><strong>NO LOGIN</strong> invite link only</span>
        </div>
      </section>
    </main>
  )
}

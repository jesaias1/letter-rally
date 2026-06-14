import { useState, type FormEvent } from 'react'
import type { SeriesLength } from '../game/series'
import { normalizeRoomCode } from '../multiplayer/roomCode'
import type { BotDifficulty } from '../singleplayer/bot'
import type { BotRecords } from '../singleplayer/records'

interface StartScreenProps {
  mode: 'menu' | 'join'
  roomCode?: string
  error?: string
  botRecords: BotRecords
  onCreateRoom: (playerName: string, roundsToPlay: SeriesLength) => void
  onJoinRoom: (playerName: string, roomCode?: string) => boolean
  onStartBot: (playerName: string, difficulty: BotDifficulty, roundsToPlay: SeriesLength) => void
}

const DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard']
const SERIES_LENGTHS: SeriesLength[] = [3, 4, 5]

export function StartScreen({ mode, roomCode, error, botRecords, onCreateRoom, onJoinRoom, onStartBot }: StartScreenProps) {
  const [playerName, setPlayerName] = useState(() => window.localStorage.getItem('letter-rally-player-name') ?? '')
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium')
  const [roundsToPlay, setRoundsToPlay] = useState<SeriesLength>(3)
  const [manualRoomCode, setManualRoomCode] = useState('')
  const joining = mode === 'join'

  function rememberName(): string {
    const name = playerName.trim() || 'Player One'
    window.localStorage.setItem('letter-rally-player-name', name)
    return name
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = rememberName()
    if (joining) onJoinRoom(name, roomCode)
    else onStartBot(name, difficulty, roundsToPlay)
  }

  return (
    <main className="start-screen">
      <div className="start-screen__noise" />
      <section className="start-card">
        <div className="start-card__brand"><span className="brand-mark brand-mark--large">LR</span><p className="eyebrow">A REAL-TIME WORD DUEL</p></div>
        <div className="start-card__hero">
          <h1>LETTER<span>RALLY</span></h1>
          <p>{joining ? `You were invited to room ${roomCode}. Choose your name and enter the rally.` : 'Play a cumulative 3, 4, or 5-round series against a bot or a friend.'}</p>
        </div>
        <form className="player-setup player-setup--online" onSubmit={handleSubmit}>
          <label>
            <span>YOUR NAME</span>
            <input autoFocus maxLength={18} placeholder={joining ? 'PLAYER TWO' : 'PLAYER ONE'} value={playerName} onChange={(event) => setPlayerName(event.target.value)} aria-label="Your player name" />
          </label>
          {!joining && (
            <>
              <fieldset className="difficulty-picker">
                <legend>BOT DIFFICULTY</legend>
                <div>{DIFFICULTIES.map((option) => <button className={difficulty === option ? 'difficulty-option difficulty-option--active' : 'difficulty-option'} key={option} type="button" aria-pressed={difficulty === option} onClick={() => setDifficulty(option)}><strong>{option}</strong><span>{botRecords[option].wins}W {botRecords[option].losses}L {botRecords[option].draws}D</span></button>)}</div>
              </fieldset>
              <fieldset className="series-picker">
                <legend>SERIES LENGTH</legend>
                <div>{SERIES_LENGTHS.map((rounds) => <button className={roundsToPlay === rounds ? 'series-option series-option--active' : 'series-option'} key={rounds} type="button" aria-pressed={roundsToPlay === rounds} onClick={() => setRoundsToPlay(rounds)}><strong>{rounds}</strong><span>ROUNDS</span></button>)}</div>
              </fieldset>
            </>
          )}
          {error && <p className="setup-error">{error}</p>}
          <button className="primary-button primary-button--start" type="submit">{joining ? 'JOIN THE RALLY' : `PLAY ${difficulty.toUpperCase()} BOT`} <span aria-hidden="true">-&gt;</span></button>
          {!joining && (
            <>
              <button className="secondary-button" type="button" onClick={() => onCreateRoom(rememberName(), roundsToPlay)}>CREATE ONLINE ROOM - {roundsToPlay} ROUNDS</button>
              <div className="manual-join">
                <label><span>HAVE A ROOM CODE?</span><input maxLength={6} placeholder="ABC123" value={manualRoomCode} onChange={(event) => setManualRoomCode(normalizeRoomCode(event.target.value))} aria-label="Room code" /></label>
                <button className="secondary-button" type="button" disabled={manualRoomCode.length !== 6} onClick={() => onJoinRoom(rememberName(), manualRoomCode)}>JOIN BY CODE</button>
              </div>
            </>
          )}
        </form>
        <div className="start-rules" aria-label="Game summary">
          <span><strong>5 SEC</strong> to claim</span><span><strong>5 MIN</strong> per round</span><span><strong>3-5 ROUNDS</strong> cumulative score</span><span><strong>NO LOGIN</strong> code or link</span>
        </div>
      </section>
    </main>
  )
}

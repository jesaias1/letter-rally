import { useState, type FormEvent } from 'react'
import type { SavedReplay } from '../game/replay'
import type { ClaimWindowSeconds, GameRules, RoundDurationMinutes } from '../game/rules'
import type { SeriesLength } from '../game/series'
import { normalizeRoomCode } from '../multiplayer/roomCode'
import type { PlayerStatistics } from '../progress/playerProgress'
import type { BotDifficulty } from '../singleplayer/bot'
import type { BotRecords } from '../singleplayer/records'
import { ProfilePanel } from './ProfilePanel'

interface StartScreenProps {
  mode: 'menu' | 'join'
  roomCode?: string
  error?: string
  botRecords: BotRecords
  statistics: PlayerStatistics
  replays: SavedReplay[]
  soundEnabled: boolean
  onToggleSound: () => void
  onCreateRoom: (playerName: string, roundsToPlay: SeriesLength, rules: GameRules) => void
  onJoinRoom: (playerName: string, roomCode?: string) => boolean
  onSpectate: (playerName: string, roomCode: string) => boolean
  onStartBot: (playerName: string, difficulty: BotDifficulty, roundsToPlay: SeriesLength, rules: GameRules) => void
  onOpenReplay: (replay: SavedReplay) => void
}

const DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard']
const SERIES_LENGTHS: SeriesLength[] = [3, 4, 5]

export function StartScreen({ mode, roomCode, error, botRecords, statistics, replays, soundEnabled, onToggleSound, onCreateRoom, onJoinRoom, onSpectate, onStartBot, onOpenReplay }: StartScreenProps) {
  const [playerName, setPlayerName] = useState(() => window.localStorage.getItem('letter-rally-player-name') ?? '')
  const [playMode, setPlayMode] = useState<'bot' | 'online'>('bot')
  const [difficulty, setDifficulty] = useState<BotDifficulty>('medium')
  const [roundsToPlay, setRoundsToPlay] = useState<SeriesLength>(3)
  const [manualRoomCode, setManualRoomCode] = useState('')
  const [claimWindowSeconds, setClaimWindowSeconds] = useState<ClaimWindowSeconds>(5)
  const [roundDurationMinutes, setRoundDurationMinutes] = useState<RoundDurationMinutes>(5)
  const [powerUpsEnabled, setPowerUpsEnabled] = useState(false)
  const joining = mode === 'join'
  const rules: GameRules = { claimWindowSeconds, roundDurationMinutes, powerUpsEnabled }

  function rememberName(): string {
    const name = playerName.trim() || 'Player One'
    window.localStorage.setItem('letter-rally-player-name', name)
    return name
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = rememberName()
    if (joining) onJoinRoom(name, roomCode)
    else if (playMode === 'bot') onStartBot(name, difficulty, roundsToPlay, rules)
    else onCreateRoom(name, roundsToPlay, rules)
  }

  return (
    <main className="start-screen">
      <div className="start-screen__noise" />
      <section className="start-card">
        <header className="start-header">
          <div className="start-card__brand"><span className="brand-mark brand-mark--large">LR</span><p className="eyebrow">REAL-TIME WORD DUELS</p></div>
          <div className="start-card__hero">
            <h1>LETTER <span>RALLY</span></h1>
            <p>{joining ? `Room ${roomCode} is ready.` : 'Claim letters. Build your word. Win the series.'}</p>
          </div>
          <div className="start-highlights" aria-label="Game summary">
            <span>NO LOGIN</span><span>3-5 ROUNDS</span><span>LIVE MULTIPLAYER</span>
          </div>
        </header>

        <form className="start-console" onSubmit={handleSubmit}>
          {!joining && (
            <div className="play-mode-switch" role="group" aria-label="Game mode">
              <button className={playMode === 'bot' ? 'play-mode-option play-mode-option--active' : 'play-mode-option'} type="button" aria-pressed={playMode === 'bot'} onClick={() => setPlayMode('bot')}>PLAY A BOT</button>
              <button className={playMode === 'online' ? 'play-mode-option play-mode-option--active' : 'play-mode-option'} type="button" aria-pressed={playMode === 'online'} onClick={() => setPlayMode('online')}>PLAY ONLINE</button>
            </div>
          )}

          <label className="console-field">
            <span>YOUR NAME</span>
            <input autoFocus maxLength={18} placeholder={joining ? 'PLAYER TWO' : 'PLAYER ONE'} value={playerName} onChange={(event) => setPlayerName(event.target.value)} aria-label="Your player name" />
          </label>

          {!joining && playMode === 'bot' && (
            <fieldset className="difficulty-picker">
              <legend>DIFFICULTY</legend>
              <div>{DIFFICULTIES.map((option) => <button className={difficulty === option ? 'difficulty-option difficulty-option--active' : 'difficulty-option'} key={option} type="button" aria-pressed={difficulty === option} onClick={() => setDifficulty(option)}><strong>{option}</strong><span>{botRecords[option].wins}W {botRecords[option].losses}L</span></button>)}</div>
            </fieldset>
          )}

          {!joining && (
            <fieldset className="series-picker series-picker--compact">
              <legend>ROUNDS</legend>
              <div>{SERIES_LENGTHS.map((rounds) => <button className={roundsToPlay === rounds ? 'series-option series-option--active' : 'series-option'} key={rounds} type="button" aria-pressed={roundsToPlay === rounds} onClick={() => setRoundsToPlay(rounds)}><strong>{rounds}</strong></button>)}</div>
            </fieldset>
          )}

          {!joining && (
            <details className="start-disclosure">
              <summary>GAME SETTINGS <span>{claimWindowSeconds}s claim / {roundDurationMinutes}m round</span></summary>
              <div className="custom-rules">
                <label><span>CLAIM TIMER</span><select value={claimWindowSeconds} onChange={(event) => setClaimWindowSeconds(Number(event.target.value) as ClaimWindowSeconds)}><option value="3">3 SEC</option><option value="5">5 SEC</option><option value="8">8 SEC</option></select></label>
                <label><span>ROUND LENGTH</span><select value={roundDurationMinutes} onChange={(event) => setRoundDurationMinutes(Number(event.target.value) as RoundDurationMinutes)}><option value="1">1 MIN</option><option value="3">3 MIN</option><option value="5">5 MIN</option></select></label>
                <button className={powerUpsEnabled ? 'rule-toggle rule-toggle--active' : 'rule-toggle'} type="button" aria-pressed={powerUpsEnabled} onClick={() => setPowerUpsEnabled((current) => !current)}>POWER-UPS {powerUpsEnabled ? 'ON' : 'OFF'}</button>
                <button className={soundEnabled ? 'rule-toggle rule-toggle--active' : 'rule-toggle'} type="button" aria-pressed={soundEnabled} onClick={onToggleSound}>SOUND {soundEnabled ? 'ON' : 'OFF'}</button>
              </div>
            </details>
          )}

          {error && <p className="setup-error">{error}</p>}
          <button className="primary-button primary-button--start" type="submit">
            {joining ? 'JOIN ROOM' : playMode === 'bot' ? `PLAY ${difficulty.toUpperCase()}` : 'CREATE ROOM'} <span aria-hidden="true">-&gt;</span>
          </button>

          {!joining && playMode === 'online' && (
            <div className="room-entry">
              <label><span>OR ENTER A ROOM CODE</span><input maxLength={6} placeholder="ABC123" value={manualRoomCode} onChange={(event) => setManualRoomCode(normalizeRoomCode(event.target.value))} aria-label="Room code" /></label>
              <button type="button" disabled={manualRoomCode.length !== 6} onClick={() => onJoinRoom(rememberName(), manualRoomCode)}>JOIN</button>
              <button type="button" disabled={manualRoomCode.length !== 6} onClick={() => onSpectate(rememberName(), manualRoomCode)}>WATCH</button>
            </div>
          )}

          {!joining && (
            <details className="start-disclosure start-disclosure--profile">
              <summary>PLAYER HISTORY <span>{statistics.seriesWon} wins / {statistics.validClaims} claims</span></summary>
              <ProfilePanel statistics={statistics} />
              {replays.length > 0 && <div className="replay-list"><span>RECENT REPLAYS</span>{replays.slice(0, 3).map((replay) => <button type="button" key={replay.id} onClick={() => onOpenReplay(replay)}>{replay.label}</button>)}</div>}
            </details>
          )}
        </form>
      </section>
    </main>
  )
}

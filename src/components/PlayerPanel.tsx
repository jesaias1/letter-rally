import { useState, type FormEvent } from 'react'
import { calculateScore } from '../game/scoring'
import type { CurrentLetterState, GameState, PlayerState } from '../game/types'
import { LetterTile } from './LetterTile'

interface PlayerFeedback {
  letterId?: string
  message: string
  tone: 'neutral' | 'success' | 'error'
}

interface PlayerPanelProps {
  side: 'left' | 'right'
  player: PlayerState
  currentLetter?: CurrentLetterState
  gameStatus: GameState['status']
  feedback: PlayerFeedback
  isLocalPlayer: boolean
  onClaim: (word: string) => void
  onFinalWord: (word: string) => void
}

export function PlayerPanel({ side, player, currentLetter, gameStatus, feedback, isLocalPlayer, onClaim, onFinalWord }: PlayerPanelProps) {
  const [claimDraft, setClaimDraft] = useState({ letterId: '', word: '' })
  const [finalWord, setFinalWord] = useState('')

  const activeLetterId = currentLetter?.id ?? ''
  const claimWord = claimDraft.letterId === activeLetterId ? claimDraft.word : ''

  const hasValidClaim = Boolean(currentLetter?.claims.some((claim) => claim.playerId === player.id && claim.valid))
  const claimActive = isLocalPlayer && gameStatus === 'playing' && !hasValidClaim
  const riskScore = calculateScore(player.board).total
  const visibleFeedback = !feedback.letterId || feedback.letterId === currentLetter?.id ? feedback : { message: 'New letter. New chance.', tone: 'neutral' as const }
  const locks = Object.entries(player.positionLocks).sort(([a], [b]) => a.localeCompare(b))

  function submitClaimForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (claimWord.trim()) onClaim(claimWord)
  }

  function submitFinalForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (finalWord.trim()) onFinalWord(finalWord)
  }

  return (
    <section className={`player-panel player-panel--${side}${isLocalPlayer ? ' player-panel--local' : ' player-panel--remote'}`}>
      <header className="player-header">
        <div className="player-identity"><span className="player-number">{player.id === 'player1' ? 'P1' : 'P2'}</span><div><p>{isLocalPlayer ? 'YOU' : 'RIVAL'}</p><h2>{player.name}</h2></div></div>
        <div className="risk-score" title="Current score if no final word can be formed"><span>RISK</span><strong>{riskScore > 0 ? `+${riskScore}` : riskScore}</strong></div>
      </header>
      <div className="panel-section board-section">
        <div className="section-heading"><span>YOUR LETTERS</span><strong>{player.board.length}</strong></div>
        <div className="letter-board">{player.board.length ? player.board.map((tile) => <LetterTile key={tile.id} tile={tile} side={side} />) : <p className="empty-board">Claim letters to build your finisher.</p>}</div>
      </div>
      <form className="claim-form" onSubmit={submitClaimForm}>
        <label htmlFor={`${player.id}-claim`}>CLAIM {currentLetter?.letter ? `“${currentLetter.letter}”` : 'LETTER'}</label>
        <div className="input-action">
          <input id={`${player.id}-claim`} autoComplete="off" disabled={!claimActive} maxLength={24} placeholder={hasValidClaim ? 'CLAIM LOCKED' : 'TYPE A 4+ LETTER WORD'} value={claimWord} onChange={(event) => setClaimDraft({ letterId: activeLetterId, word: event.target.value.toUpperCase() })} />
          <button type="submit" disabled={!claimActive || !claimWord.trim()}>LOCK</button>
        </div>
        <p className={`form-feedback form-feedback--${visibleFeedback.tone}`}><span />{visibleFeedback.message}</p>
      </form>
      <form className="final-form" onSubmit={submitFinalForm}>
        <div><label htmlFor={`${player.id}-final`}>FINAL WORD</label><span>5+ LETTERS · USE YOUR TILES</span></div>
        <div className="input-action input-action--final">
          <input id={`${player.id}-final`} autoComplete="off" disabled={!isLocalPlayer || gameStatus === 'roundOver'} maxLength={24} placeholder={isLocalPlayer ? 'BUILD TO WIN' : 'RIVAL BOARD'} value={finalWord} onChange={(event) => setFinalWord(event.target.value.toUpperCase())} />
          <button type="submit" disabled={!isLocalPlayer || !finalWord.trim() || gameStatus === 'roundOver'}>GO</button>
        </div>
      </form>
      <div className="intel-grid">
        <div><span className="intel-title">POSITION LOCKS</span><div className="chip-list">{locks.length ? locks.map(([letter, positions]) => <span className="info-chip" key={letter}>{letter} · {positions.join('/')}</span>) : <span className="info-chip info-chip--muted">NONE YET</span>}</div></div>
        <div><span className="intel-title">USED CLAIMS</span><div className="chip-list">{player.usedClaimWords.length ? player.usedClaimWords.slice(-4).map((word) => <span className="info-chip info-chip--word" key={word}>{word}</span>) : <span className="info-chip info-chip--muted">OPEN BOOK</span>}</div></div>
      </div>
    </section>
  )
}

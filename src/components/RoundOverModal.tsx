import { calculateScore } from '../game/scoring'
import type { SeriesState } from '../game/series'
import type { GameState, PlayerId } from '../game/types'
import { LetterTile } from './LetterTile'

interface RoundOverModalProps {
  game: GameState
  playerIds: PlayerId[]
  canPlayAgain: boolean
  series: SeriesState
  onPlayAgain: () => void
  onLeave: () => void
}

export function RoundOverModal({ game, playerIds, canPlayAgain, series, onPlayAgain, onLeave }: RoundOverModalProps) {
  const roundTitle = game.winner ? `${game.players[game.winner].name} wins round` : 'Round drawn'
  const title = series.complete
    ? series.winner ? `${game.players[series.winner].name} wins series` : 'Series drawn'
    : roundTitle
  const wordLabel = game.winReason === 'finalWord' ? 'Submitted word' : 'Best word'

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <p className="eyebrow">{series.complete ? 'SERIES COMPLETE' : `ROUND ${series.roundsPlayed} OF ${series.roundsToPlay}`}</p>
        <h2 id="result-title">{title}</h2>
        <p className="result-modal__message">{game.resultMessage}</p>
        <div className="series-score" aria-label="Series totals">
          <span>{game.players.player1.name}</span>
          <strong>{series.totalScore.player1} : {series.totalScore.player2}</strong>
          <span>{game.players.player2.name}</span>
        </div>
        <p className="round-win-score">ROUND WINS {series.roundWins.player1} - {series.roundWins.player2}</p>

        {game.winningWord && <div className="winning-word" aria-label={`Winning word ${game.winningWord}`}>{[...game.winningWord].map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}</div>}

        <div className="scorecards">
          {playerIds.map((playerId) => {
            const player = game.players[playerId]
            const details = calculateScore(player.board, player.bestWord, player.powerUps.shieldedTileId)
            return (
              <article className={game.winner === playerId ? 'scorecard scorecard--winner' : 'scorecard'} key={playerId}>
                <div className="scorecard__header"><span>{player.name}</span><strong>{player.score}</strong></div>
                <div className="scorecard__tiles">{player.board.map((tile) => <LetterTile key={tile.id} tile={tile} side={playerId === 'player1' ? 'left' : 'right'} shielded={player.powerUps.shieldedTileId === tile.id} />)}</div>
                <p>{wordLabel}: <strong>{player.bestWord ?? 'None'}</strong></p>
                <small>Word {details.wordValue} + length {details.lengthBonus} - unused {details.unusedPenalty}</small>
              </article>
            )
          })}
        </div>

        <div className="result-actions">
          {canPlayAgain ? <button className="primary-button" type="button" onClick={onPlayAgain} autoFocus>{series.complete ? 'NEW SERIES' : 'NEXT ROUND'} <span aria-hidden="true">&#8635;</span></button> : <p className="result-waiting">Waiting for the host to start the next round.</p>}
          <button className="secondary-button" type="button" onClick={onLeave}>BACK TO MENU</button>
        </div>
      </section>
    </div>
  )
}

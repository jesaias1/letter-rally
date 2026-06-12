import { calculateScore } from '../game/scoring'
import type { GameState, PlayerId } from '../game/types'
import { LetterTile } from './LetterTile'

interface RoundOverModalProps {
  game: GameState
  playerIds: PlayerId[]
  canPlayAgain: boolean
  onPlayAgain: () => void
}

export function RoundOverModal({
  game,
  playerIds,
  canPlayAgain,
  onPlayAgain,
}: RoundOverModalProps) {
  const title = game.winner ? `${game.players[game.winner].name} wins` : 'Dead heat'
  const wordLabel = game.winReason === 'finalWord' ? 'Submitted word' : 'Best word'

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="result-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
      >
        <p className="eyebrow">RALLY COMPLETE</p>
        <h2 id="result-title">{title}</h2>
        <p className="result-modal__message">{game.resultMessage}</p>

        {game.winningWord && (
          <div className="winning-word" aria-label={`Winning word ${game.winningWord}`}>
            {[...game.winningWord].map((letter, index) => (
              <span key={`${letter}-${index}`}>{letter}</span>
            ))}
          </div>
        )}

        <div className="scorecards">
          {playerIds.map((playerId) => {
            const player = game.players[playerId]
            const details = calculateScore(player.board, player.bestWord)

            return (
              <article
                className={game.winner === playerId ? 'scorecard scorecard--winner' : 'scorecard'}
                key={playerId}
              >
                <div className="scorecard__header">
                  <span>{player.name}</span>
                  <strong>{player.score}</strong>
                </div>
                <div className="scorecard__tiles">
                  {player.board.map((tile) => (
                    <LetterTile
                      key={tile.id}
                      tile={tile}
                      side={playerId === 'player1' ? 'left' : 'right'}
                    />
                  ))}
                </div>
                <p>
                  {wordLabel}: <strong>{player.bestWord ?? 'None'}</strong>
                </p>
                <small>
                  Word {details.wordValue} + length {details.lengthBonus} - unused{' '}
                  {details.unusedPenalty}
                </small>
              </article>
            )
          })}
        </div>

        {canPlayAgain ? (
          <button className="primary-button" type="button" onClick={onPlayAgain} autoFocus>
            PLAY AGAIN <span aria-hidden="true">↻</span>
          </button>
        ) : (
          <p className="result-waiting">Waiting for the host to start the rematch.</p>
        )}
      </section>
    </div>
  )
}

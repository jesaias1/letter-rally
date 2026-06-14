import {
  LETTER_RESOLUTION_MS,
  LETTER_VALUES,
  START_COUNTDOWN_MS,
  TIE_THRESHOLD_MS,
} from './constants'
import { drawWeightedLetter } from './letterGenerator'
import { DEFAULT_GAME_RULES, claimWindowMs, roundDurationMs, type GameRules } from './rules'
import { calculateScore, findBestFinalWord, getWordValue } from './scoring'
import type {
  ClaimAttempt,
  GameLogEntry,
  GameState,
  PlayerId,
  PlayerState,
  ValidationResult,
  PowerUpKind,
} from './types'
import { isValidClaimWord, isValidFinalWord } from './validation'

let sequence = 0

function createId(prefix: string, time: number): string {
  sequence += 1
  return `${prefix}-${time}-${sequence}`
}

function createPlayer(id: PlayerId, name: string): PlayerState {
  return {
    id,
    name: name.trim() || (id === 'player1' ? 'Player One' : 'Player Two'),
    board: [],
    positionLocks: {},
    usedClaimWords: [],
    score: 0,
    powerUps: { swapAvailable: true, shieldAvailable: true },
  }
}

function logEntry(
  time: number,
  type: GameLogEntry['type'],
  message: string,
): GameLogEntry {
  return { id: createId('log', time), time, type, message }
}

export function createGame(playerOneName = 'Player One', playerTwoName = 'Player Two', rules: GameRules = DEFAULT_GAME_RULES): GameState {
  return {
    rules,
    status: 'idle',
    players: {
      player1: createPlayer('player1', playerOneName),
      player2: createPlayer('player2', playerTwoName),
    },
    log: [],
  }
}

export function startRound(state: GameState, now: number): GameState {
  return {
    ...state,
    status: 'countdown',
    countdownEndsAt: now + START_COUNTDOWN_MS,
    roundStartedAt: now + START_COUNTDOWN_MS,
    roundEndsAt: now + START_COUNTDOWN_MS + roundDurationMs(state.rules),
    log: [logEntry(now, 'system', 'Match ready. First rally incoming.')],
  }
}

export function revealNextLetter(
  state: GameState,
  now: number,
  random: () => number = Math.random,
): GameState {
  const letter = drawWeightedLetter(state.currentLetter?.letter, random)
  return {
    ...state,
    status: 'playing',
    nextLetterAt: undefined,
    currentLetter: {
      id: createId('letter', now),
      letter,
      startedAt: now,
      endsAt: now + claimWindowMs(state.rules),
      claims: [],
      resolved: false,
    },
    resultMessage: `${letter} is live`,
    log: [...state.log, logEntry(now, 'letter', `${letter} appeared.`)],
  }
}

export function submitClaim(
  state: GameState,
  playerId: PlayerId,
  word: string,
  now: number,
): { state: GameState; attempt: ClaimAttempt } {
  const currentLetter = state.currentLetter
  let validation: ValidationResult

  if (state.status !== 'playing' || !currentLetter || currentLetter.resolved) {
    validation = { valid: false, normalizedWord: word.trim().toUpperCase(), reason: 'No active letter.' }
  } else if (now > currentLetter.endsAt) {
    validation = {
      valid: false,
      normalizedWord: word.trim().toUpperCase(),
      reason: 'The claim window has closed.',
    }
  } else if (currentLetter.claims.some((claim) => claim.playerId === playerId && claim.valid)) {
    validation = {
      valid: false,
      normalizedWord: word.trim().toUpperCase(),
      reason: 'You already locked in a valid claim.',
    }
  } else {
    validation = isValidClaimWord(word, currentLetter.letter, state.players[playerId])
  }

  const attempt: ClaimAttempt = {
    playerId,
    word,
    normalizedWord: validation.normalizedWord,
    submittedAt: now,
    valid: validation.valid,
    reason: validation.reason,
    lockedPosition: validation.lockedPosition,
  }

  if (!currentLetter) return { state, attempt }

  const updatedPlayer = validation.valid
    ? {
        ...state.players[playerId],
        usedClaimWords: [
          ...state.players[playerId].usedClaimWords,
          validation.normalizedWord,
        ],
      }
    : state.players[playerId]

  return {
    state: {
      ...state,
      players: { ...state.players, [playerId]: updatedPlayer },
      currentLetter: {
        ...currentLetter,
        claims: [...currentLetter.claims, attempt],
      },
      log: validation.valid
        ? state.log
        : [
            ...state.log,
            logEntry(now, 'reject', `${state.players[playerId].name}: ${validation.reason}`),
          ],
    },
    attempt,
  }
}

export function pickClaimWinner(validClaims: ClaimAttempt[]): ClaimAttempt | undefined {
  if (validClaims.length === 0) return undefined
  if (validClaims.length === 1) return validClaims[0]

  const [first, second] = [...validClaims].sort((a, b) => a.submittedAt - b.submittedAt)
  if (second.submittedAt - first.submittedAt > TIE_THRESHOLD_MS) return first
  if (first.normalizedWord.length !== second.normalizedWord.length) {
    return first.normalizedWord.length > second.normalizedWord.length ? first : second
  }

  const firstValue = getWordValue(first.normalizedWord)
  const secondValue = getWordValue(second.normalizedWord)
  if (firstValue !== secondValue) return firstValue > secondValue ? first : second
  return undefined
}

export function resolveCurrentLetter(state: GameState, now: number): GameState {
  const currentLetter = state.currentLetter
  if (!currentLetter || currentLetter.resolved) return state

  const winnerClaim = pickClaimWinner(currentLetter.claims.filter((claim) => claim.valid))

  if (!winnerClaim) {
    const hadValidClaims = currentLetter.claims.some((claim) => claim.valid)
    const message = hadValidClaims
      ? `${currentLetter.letter} ended in a dead heat.`
      : `${currentLetter.letter} was skipped.`
    return {
      ...state,
      status: 'letterResolution',
      nextLetterAt: now + LETTER_RESOLUTION_MS,
      resultMessage: message,
      currentLetter: { ...currentLetter, resolved: true },
      log: [...state.log, logEntry(now, 'letter', message)],
    }
  }

  const player = state.players[winnerClaim.playerId]
  const letter = currentLetter.letter
  const lockedPosition = winnerClaim.lockedPosition as number
  const tile = {
    id: createId('tile', now),
    letter,
    value: LETTER_VALUES[letter],
    claimedAt: now,
  }
  const message = `${player.name} claimed ${letter} with ${winnerClaim.normalizedWord}, locking position ${lockedPosition}.`

  return {
    ...state,
    status: 'letterResolution',
    nextLetterAt: now + LETTER_RESOLUTION_MS,
    resultMessage: `${player.name} wins ${letter}`,
    currentLetter: { ...currentLetter, resolved: true },
    players: {
      ...state.players,
      [winnerClaim.playerId]: {
        ...player,
        board: [...player.board, tile],
        positionLocks: {
          ...player.positionLocks,
          [letter]: [...(player.positionLocks[letter] ?? []), lockedPosition],
        },
      },
    },
    log: [...state.log, logEntry(now, 'claim', message)],
  }
}

export function submitFinalWord(
  state: GameState,
  playerId: PlayerId,
  word: string,
  now: number,
): { state: GameState; result: ValidationResult } {
  if (state.status !== 'playing' && state.status !== 'letterResolution') {
    return {
      state,
      result: { valid: false, normalizedWord: word.trim().toUpperCase(), reason: 'The round is not active.' },
    }
  }

  const player = state.players[playerId]
  const result = isValidFinalWord(word, player.board)
  if (!result.valid) return { state, result }

  const opponentId: PlayerId = playerId === 'player1' ? 'player2' : 'player1'
  const opponent = state.players[opponentId]
  const score = calculateScore(player.board, result.normalizedWord, player.powerUps.shieldedTileId).total
  const opponentScore = calculateScore(opponent.board, undefined, opponent.powerUps.shieldedTileId).total
  const message = `${player.name} wins with ${result.normalizedWord}!`
  return {
    result,
    state: {
      ...state,
      status: 'roundOver',
      winner: playerId,
      winReason: 'finalWord',
      winningWord: result.normalizedWord,
      resultMessage: message,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          submittedFinalWord: result.normalizedWord,
          bestWord: result.normalizedWord,
          score,
        },
        [opponentId]: {
          ...opponent,
          bestWord: undefined,
          score: opponentScore,
        },
      },
      log: [...state.log, logEntry(now, 'win', message)],
    },
  }
}

export function endRoundByScore(state: GameState, now: number): GameState {
  const scoredPlayers = (['player1', 'player2'] as PlayerId[]).reduce(
    (players, playerId) => {
      const player = state.players[playerId]
      const bestWord = findBestFinalWord(player.board)
      const score = calculateScore(player.board, bestWord, player.powerUps.shieldedTileId).total
      players[playerId] = { ...player, bestWord, score }
      return players
    },
    {} as Record<PlayerId, PlayerState>,
  )

  const playerOneScore = scoredPlayers.player1.score
  const playerTwoScore = scoredPlayers.player2.score
  const winner =
    playerOneScore === playerTwoScore
      ? undefined
      : playerOneScore > playerTwoScore
        ? 'player1'
        : 'player2'
  const message = winner
    ? `${scoredPlayers[winner].name} wins on score, ${scoredPlayers[winner].score} to ${scoredPlayers[winner === 'player1' ? 'player2' : 'player1'].score}.`
    : `The round ends in a ${playerOneScore}-${playerTwoScore} draw.`

  return {
    ...state,
    status: 'roundOver',
    players: scoredPlayers,
    winner,
    winReason: winner ? 'score' : 'draw',
    winningWord: winner ? scoredPlayers[winner].bestWord : undefined,
    resultMessage: message,
    log: [...state.log, logEntry(now, 'win', message)],
  }
}

export function activatePowerUp(
  state: GameState,
  playerId: PlayerId,
  kind: PowerUpKind,
  now: number,
  random: () => number = Math.random,
): { state: GameState; result: ValidationResult } {
  const player = state.players[playerId]
  const invalid = (reason: string) => ({ state, result: { valid: false, normalizedWord: '', reason } })

  if (!state.rules.powerUpsEnabled) return invalid('Power-ups are disabled for this match.')
  if (state.status === 'roundOver' || state.status === 'idle') return invalid('The round is not active.')
  if (!player.board.length) return invalid('Claim a tile before using a power-up.')

  if (kind === 'shield') {
    if (!player.powerUps.shieldAvailable) return invalid('Shield already used this round.')
    const tile = player.board[player.board.length - 1]
    const nextPlayer = {
      ...player,
      powerUps: { ...player.powerUps, shieldAvailable: false, shieldedTileId: tile.id },
    }
    return {
      result: { valid: true, normalizedWord: '' },
      state: {
        ...state,
        players: { ...state.players, [playerId]: nextPlayer },
        log: [...state.log, logEntry(now, 'system', `${player.name} shielded ${tile.letter} from the unused penalty.`)],
      },
    }
  }

  if (!player.powerUps.swapAvailable) return invalid('Swap already used this round.')
  const oldTile = player.board[player.board.length - 1]
  const newLetter = drawWeightedLetter(oldTile.letter, random)
  const replacement = { ...oldTile, id: createId('swap', now), letter: newLetter, value: LETTER_VALUES[newLetter], claimedAt: now }
  const nextBoard = [...player.board.slice(0, -1), replacement]
  const shieldedTileId = player.powerUps.shieldedTileId === oldTile.id
    ? replacement.id
    : player.powerUps.shieldedTileId
  return {
    result: { valid: true, normalizedWord: '' },
    state: {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          board: nextBoard,
          powerUps: { ...player.powerUps, swapAvailable: false, shieldedTileId },
        },
      },
      log: [...state.log, logEntry(now, 'system', `${player.name} swapped ${oldTile.letter} for ${newLetter}.`)],
    },
  }
}

export function advanceGameClock(game: GameState, now: number, random: () => number = Math.random): GameState {
  if (game.status === 'countdown' && now >= (game.countdownEndsAt ?? Infinity)) {
    return revealNextLetter(game, now, random)
  }

  if (
    (game.status === 'playing' || game.status === 'letterResolution') &&
    now >= (game.roundEndsAt ?? Infinity)
  ) {
    return endRoundByScore(game, now)
  }

  if (game.status === 'playing' && game.currentLetter && now >= game.currentLetter.endsAt) {
    return resolveCurrentLetter(game, now)
  }

  if (game.status === 'letterResolution' && now >= (game.nextLetterAt ?? Infinity)) {
    return revealNextLetter(game, now, random)
  }

  return game
}

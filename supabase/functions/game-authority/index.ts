import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  activatePowerUp,
  advanceGameClock,
  createGame,
  startRound,
  submitClaim,
  submitFinalWord,
} from '../../../src/game/gameEngine.ts'
import { createSeries, recordSeriesRound } from '../../../src/game/series.ts'
import { DEFAULT_GAME_RULES } from '../../../src/game/rules.ts'
import type { GameState, PlayerId, PowerUpKind } from '../../../src/game/types.ts'
import type { SeriesState } from '../../../src/game/series.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type AuthorityAction =
  | { kind: 'claim'; word: string }
  | { kind: 'finalWord'; word: string }
  | { kind: 'powerUp'; powerUp: PowerUpKind }
  | { kind: 'playAgain' }
  | { kind: 'tick' }

interface RoomRow {
  room_code: string
  host_token: string
  guest_token?: string
  host_name: string
  guest_name?: string
  game_state: GameState
  series_state: SeriesState
  revision: number
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)

  try {
    const body = await request.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const roomCode = normalizeRoomCode(body.roomCode)
    if (!roomCode) return response({ error: 'Invalid room code.' }, 400)

    if (body.operation === 'create') {
      const hostToken = crypto.randomUUID()
      const hostName = cleanName(body.playerName, 'Player One')
      const rounds = [3, 4, 5].includes(Number(body.roundsToPlay)) ? Number(body.roundsToPlay) : 3
      const rules = {
        claimWindowSeconds: [3, 5, 8].includes(Number(body.rules?.claimWindowSeconds)) ? Number(body.rules.claimWindowSeconds) : DEFAULT_GAME_RULES.claimWindowSeconds,
        roundDurationMinutes: [1, 3, 5].includes(Number(body.rules?.roundDurationMinutes)) ? Number(body.rules.roundDurationMinutes) : DEFAULT_GAME_RULES.roundDurationMinutes,
        powerUpsEnabled: Boolean(body.rules?.powerUpsEnabled),
      }
      const game = createGame(hostName, 'Waiting for rival', rules)
      const series = createSeries(rounds as 3 | 4 | 5)
      const { error } = await supabase.from('game_rooms').insert({
        room_code: roomCode,
        host_token: hostToken,
        host_name: hostName,
        game_state: game,
        series_state: series,
      })
      if (error) throw error
      return response({ roomCode, token: hostToken, playerId: 'player1', game, series, revision: 0 })
    }

    const { data, error } = await supabase.from('game_rooms').select('*').eq('room_code', roomCode).single()
    if (error || !data) return response({ error: 'Room not found.' }, 404)
    const room = data as RoomRow

    if (body.operation === 'join') {
      if (room.guest_token) return response({ error: 'This room already has two players.' }, 409)
      const guestToken = crypto.randomUUID()
      const guestName = cleanName(body.playerName, 'Player Two')
      const game = startRound(createGame(room.host_name, guestName, room.game_state.rules), Date.now())
      const updated = await updateRoom(supabase, room, game, room.series_state, {
        guest_token: guestToken,
        guest_name: guestName,
      })
      return response({ token: guestToken, playerId: 'player2', ...updated })
    }

    if (body.operation === 'spectate') {
      return response(publicState(room))
    }

    if (body.operation !== 'action') return response({ error: 'Unknown operation.' }, 400)
    const token = String(body.token ?? '')
    const playerId: PlayerId | undefined = token === room.host_token ? 'player1' : token === room.guest_token ? 'player2' : undefined
    if (!playerId) return response({ error: 'Invalid player token.' }, 403)
    if (Number(body.revision) !== room.revision) return response({ error: 'State changed. Refresh and retry.', ...publicState(room) }, 409)

    const action = body.action as AuthorityAction
    const now = Date.now()
    let nextGame = room.game_state
    let nextSeries = room.series_state
    let result: object = { valid: true }

    if (action.kind === 'claim') {
      const submission = submitClaim(nextGame, playerId, String(action.word ?? ''), now)
      nextGame = submission.state
      result = submission.attempt
    } else if (action.kind === 'finalWord') {
      const submission = submitFinalWord(nextGame, playerId, String(action.word ?? ''), now)
      nextGame = submission.state
      result = submission.result
    } else if (action.kind === 'powerUp') {
      const activation = activatePowerUp(nextGame, playerId, action.powerUp, now)
      nextGame = activation.state
      result = activation.result
    } else if (action.kind === 'playAgain') {
      if (playerId !== 'player1') return response({ error: 'Only the host can start the next round.' }, 403)
      if (nextSeries.complete) nextSeries = createSeries(nextSeries.roundsToPlay)
      nextGame = startRound(createGame(room.host_name, room.guest_name ?? 'Player Two', nextGame.rules), now)
    } else if (action.kind === 'tick') {
      if (playerId !== 'player1') return response({ error: 'Only the host clock may tick.' }, 403)
      nextGame = advanceGameClock(nextGame, now)
    } else {
      return response({ error: 'Unknown action.' }, 400)
    }

    if (room.game_state.status !== 'roundOver' && nextGame.status === 'roundOver') {
      nextSeries = recordSeriesRound(nextSeries, nextGame)
    }
    const updated = await updateRoom(supabase, room, nextGame, nextSeries)
    return response({ ...updated, result })
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Authority request failed.' }, 500)
  }
})

async function updateRoom(supabase: ReturnType<typeof createClient>, room: RoomRow, game: GameState, series: SeriesState, extra: object = {}) {
  const revision = room.revision + 1
  const { data, error } = await supabase
    .from('game_rooms')
    .update({ ...extra, game_state: game, series_state: series, revision, updated_at: new Date().toISOString() })
    .eq('room_code', room.room_code)
    .eq('revision', room.revision)
    .select('*')
    .single()
  if (error || !data) throw new Error('State conflict. Refresh and retry.')
  return publicState(data as RoomRow)
}

function publicState(room: RoomRow) {
  return { roomCode: room.room_code, game: room.game_state, series: room.series_state, revision: room.revision }
}

function normalizeRoomCode(value: unknown): string | undefined {
  const code = String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return /^[A-Z0-9]{6}$/.test(code) ? code : undefined
}

function cleanName(value: unknown, fallback: string): string {
  return String(value ?? '').trim().slice(0, 18) || fallback
}

function response(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

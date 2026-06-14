import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)

  try {
    const body = await request.json()
    const word = String(body.word ?? '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 24)
    const reason = String(body.reason ?? '').trim().slice(0, 300)
    const roomCode = String(body.roomCode ?? '').trim().toUpperCase().slice(0, 6) || null
    if (word.length < 2 || !reason) return response({ error: 'A word and reason are required.' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { error } = await supabase.from('dictionary_reports').insert({
      word,
      reason,
      room_code: roomCode,
      reported_at: new Date(Number(body.reportedAt) || Date.now()).toISOString(),
    })
    if (error) throw error
    return response({ accepted: true })
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Report failed.' }, 500)
  }
})

function response(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

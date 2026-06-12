import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://okmrobbuljzeutrrdpxv.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined

export const supabase = SUPABASE_PUBLISHABLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  : undefined

export const supabaseConfigurationError = SUPABASE_PUBLISHABLE_KEY
  ? undefined
  : 'Add VITE_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the app.'

import { supabase } from '../multiplayer/supabase'

export interface DictionaryReport {
  word: string
  roomCode?: string
  reason: string
  reportedAt: number
}

const STORAGE_KEY = 'letter-rally-dictionary-reports'

function storeLocally(report: DictionaryReport): void {
  try {
    const current = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as DictionaryReport[]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([report, ...current].slice(0, 50)))
  } catch {
    // Reporting should never interrupt play.
  }
}

export async function reportDictionaryWord(report: DictionaryReport): Promise<boolean> {
  storeLocally(report)
  if (!supabase) return false
  const { error } = await supabase.functions.invoke('dictionary-report', { body: report })
  return !error
}

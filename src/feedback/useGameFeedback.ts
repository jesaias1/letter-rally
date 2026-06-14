import { useEffect, useRef } from 'react'
import type { GameState, PlayerId } from '../game/types'

function tone(frequency: number, duration: number, volume = 0.035): void {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextClass) return
  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = frequency
  gain.gain.value = volume
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration / 1_000)
  oscillator.stop(context.currentTime + duration / 1_000)
  oscillator.addEventListener('ended', () => void context.close())
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

export function useGameFeedback(game: GameState, localPlayerId: PlayerId, enabled: boolean): void {
  const lastLogId = useRef<string | undefined>(undefined)

  useEffect(() => {
    const entry = game.log[game.log.length - 1]
    if (!enabled || !entry || entry.id === lastLogId.current) return
    lastLogId.current = entry.id

    if (entry.type === 'letter') tone(360, 90)
    if (entry.type === 'claim') {
      const localWon = entry.message.startsWith(game.players[localPlayerId].name)
      tone(localWon ? 720 : 260, 150)
      if (localWon) navigator.vibrate?.(35)
    }
    if (entry.type === 'reject') {
      tone(150, 180)
      navigator.vibrate?.([25, 35, 25])
    }
    if (entry.type === 'win') {
      tone(game.winner === localPlayerId ? 880 : 190, 300, 0.05)
      navigator.vibrate?.(game.winner === localPlayerId ? [50, 40, 80] : 100)
    }
  }, [enabled, game.log, game.players, game.winner, localPlayerId])
}

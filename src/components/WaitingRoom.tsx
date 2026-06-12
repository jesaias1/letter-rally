import { useState } from 'react'
import type { ConnectionStatus } from '../multiplayer/types'

interface WaitingRoomProps {
  connectionStatus: ConnectionStatus
  connectedPlayers: number
  error?: string
  inviteUrl: string
  isHost: boolean
  roomCode: string
}

export function WaitingRoom({ connectionStatus, connectedPlayers, error, inviteUrl, isHost, roomCode }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false)

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main className="start-screen">
      <div className="start-screen__noise" />
      <section className="start-card waiting-card">
        <span className="brand-mark brand-mark--large">LR</span>
        <p className="eyebrow">ROOM {roomCode}</p>
        <h1>{isHost ? 'Invite your rival' : 'Joining rally'}</h1>
        <p>{isHost ? 'Send this link to one friend. The five-minute match starts automatically when they connect.' : 'Connecting to the host. Keep this tab open.'}</p>

        {isHost && (
          <div className="invite-box">
            <input readOnly value={inviteUrl} aria-label="Friend invite URL" />
            <button type="button" onClick={copyInvite}>{copied ? 'COPIED' : 'COPY LINK'}</button>
          </div>
        )}

        <div className="connection-readout">
          <span className={`connection-light connection-light--${connectionStatus}`} />
          <strong>{connectionStatus === 'connected' ? `${Math.min(connectedPlayers, 2)} / 2 players connected` : 'Connecting to Supabase...'}</strong>
        </div>
        {error && <p className="setup-error">{error}</p>}
      </section>
    </main>
  )
}

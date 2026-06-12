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
  const [copied, setCopied] = useState<'code' | 'link'>()

  async function copyText(value: string, type: 'code' | 'link') {
    await navigator.clipboard.writeText(value)
    setCopied(type)
    window.setTimeout(() => setCopied(undefined), 1800)
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
          <div className="invite-options">
            <div className="room-code-box">
              <span>ROOM CODE</span>
              <strong>{roomCode}</strong>
              <button type="button" onClick={() => copyText(roomCode, 'code')}>
                {copied === 'code' ? 'COPIED' : 'COPY CODE'}
              </button>
            </div>
            <div className="invite-box">
              <label htmlFor="friend-invite-url">FULL INVITE URL</label>
              <div>
                <input id="friend-invite-url" readOnly value={inviteUrl} aria-label="Friend invite URL" />
                <button type="button" onClick={() => copyText(inviteUrl, 'link')}>
                  {copied === 'link' ? 'COPIED' : 'COPY LINK'}
                </button>
              </div>
            </div>
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

import { useState } from 'react'
import { ConfigurationScreen } from './components/ConfigurationScreen'
import { GameView } from './components/GameView'
import { StartScreen } from './components/StartScreen'
import { WaitingRoom } from './components/WaitingRoom'
import { useMultiplayerGame } from './multiplayer/useMultiplayerGame'
import { useSinglePlayerGame } from './singleplayer/useSinglePlayerGame'
import './styles/game.css'

type AppMode = 'menu' | 'multiplayer' | 'singleplayer'

export function App() {
  const multiplayer = useMultiplayerGame()
  const singlePlayer = useSinglePlayerGame()
  const [mode, setMode] = useState<AppMode>(() => multiplayer.invitedRoomCode ? 'multiplayer' : 'menu')

  if (mode === 'menu') {
    return <StartScreen mode="menu" botRecords={singlePlayer.botRecords} onCreateRoom={(name) => { multiplayer.createRoom(name); setMode('multiplayer') }} onJoinRoom={multiplayer.joinRoom} onStartBot={(name, difficulty) => { singlePlayer.startGame(name, difficulty); setMode('singleplayer') }} />
  }

  if (mode === 'singleplayer' && singlePlayer.session) {
    return <GameView game={singlePlayer.game} now={singlePlayer.now} localPlayerId={singlePlayer.localPlayerId} feedback={singlePlayer.feedback} matchWins={singlePlayer.matchWins} modeLabel={`SOLO - ${singlePlayer.session.difficulty.toUpperCase()} BOT`} canPlayAgain onClaim={singlePlayer.submitClaim} onFinalWord={singlePlayer.submitFinalWord} onPlayAgain={singlePlayer.playAgain} onLeave={() => { singlePlayer.leaveGame(); setMode('menu') }} />
  }

  if (multiplayer.configurationError) return <ConfigurationScreen message={multiplayer.configurationError} />

  if (!multiplayer.session) {
    return <StartScreen mode="join" roomCode={multiplayer.invitedRoomCode} error={multiplayer.roomError} botRecords={singlePlayer.botRecords} onCreateRoom={multiplayer.createRoom} onJoinRoom={multiplayer.joinRoom} onStartBot={singlePlayer.startGame} />
  }

  if (multiplayer.game.status === 'idle') {
    return <WaitingRoom connectionStatus={multiplayer.connectionStatus} connectedPlayers={multiplayer.connectedPlayers} error={multiplayer.roomError} inviteUrl={multiplayer.inviteUrl ?? ''} isHost={multiplayer.session.role === 'host'} roomCode={multiplayer.session.roomCode} />
  }

  return <GameView game={multiplayer.game} now={multiplayer.now} localPlayerId={multiplayer.localPlayerId ?? 'player1'} feedback={multiplayer.feedback} matchWins={multiplayer.matchWins} modeLabel={`ONLINE ROOM - ${multiplayer.session.roomCode}`} canPlayAgain={multiplayer.session.role === 'host'} onClaim={multiplayer.submitClaim} onFinalWord={multiplayer.submitFinalWord} onPlayAgain={multiplayer.playAgain} onLeave={() => window.location.assign(window.location.pathname)} />
}

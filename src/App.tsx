import { useState } from 'react'
import { ConfigurationScreen } from './components/ConfigurationScreen'
import { GameView } from './components/GameView'
import { ReplayViewer } from './components/ReplayViewer'
import { StartScreen } from './components/StartScreen'
import { WaitingRoom } from './components/WaitingRoom'
import { reportDictionaryWord } from './dictionary/reports'
import type { SavedReplay } from './game/replay'
import { useMultiplayerGame } from './multiplayer/useMultiplayerGame'
import { useSinglePlayerGame } from './singleplayer/useSinglePlayerGame'
import './styles/game.css'

type AppMode = 'menu' | 'multiplayer' | 'singleplayer'

export function App() {
  const multiplayer = useMultiplayerGame()
  const singlePlayer = useSinglePlayerGame()
  const [mode, setMode] = useState<AppMode>(() => multiplayer.invitedRoomCode ? 'multiplayer' : 'menu')
  const [replay, setReplay] = useState<SavedReplay>()
  const [soundEnabled, setSoundEnabled] = useState(() => window.localStorage.getItem('letter-rally-sound') !== 'off')

  function toggleSound() {
    setSoundEnabled((current) => {
      window.localStorage.setItem('letter-rally-sound', current ? 'off' : 'on')
      return !current
    })
  }

  function reportWord(word: string, reason: string) {
    void reportDictionaryWord({
      word,
      reason,
      roomCode: multiplayer.session?.roomCode,
      reportedAt: Date.now(),
    })
  }

  if (replay) return <ReplayViewer replay={replay} onClose={() => setReplay(undefined)} />

  if (mode === 'menu') {
    return (
      <StartScreen
        mode="menu"
        error={multiplayer.roomError}
        botRecords={singlePlayer.botRecords}
        statistics={singlePlayer.statistics}
        replays={singlePlayer.replays}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onCreateRoom={(name, rounds, rules) => {
          multiplayer.createRoom(name, rounds, rules)
          setMode('multiplayer')
        }}
        onJoinRoom={(name, roomCode) => {
          const joined = multiplayer.joinRoom(name, roomCode)
          if (joined) setMode('multiplayer')
          return joined
        }}
        onSpectate={(name, roomCode) => {
          const joined = multiplayer.spectateRoom(name, roomCode)
          if (joined) setMode('multiplayer')
          return joined
        }}
        onStartBot={(name, difficulty, rounds, rules) => {
          singlePlayer.startGame(name, difficulty, rounds, rules)
          setMode('singleplayer')
        }}
        onOpenReplay={setReplay}
      />
    )
  }

  if (mode === 'singleplayer' && singlePlayer.session) {
    return (
      <GameView
        game={singlePlayer.game}
        now={singlePlayer.now}
        localPlayerId={singlePlayer.localPlayerId}
        feedback={singlePlayer.feedback}
        series={singlePlayer.series}
        modeLabel={`SOLO - ${singlePlayer.session.difficulty.toUpperCase()} BOT`}
        canPlayAgain
        soundEnabled={soundEnabled}
        onClaim={singlePlayer.submitClaim}
        onFinalWord={singlePlayer.submitFinalWord}
        onPowerUp={singlePlayer.usePowerUp}
        onReportWord={reportWord}
        onPlayAgain={singlePlayer.playAgain}
        onLeave={() => { singlePlayer.leaveGame(); setMode('menu') }}
      />
    )
  }

  if (multiplayer.configurationError) return <ConfigurationScreen message={multiplayer.configurationError} />

  if (!multiplayer.session) {
    return (
      <StartScreen
        mode="join"
        roomCode={multiplayer.invitedRoomCode}
        error={multiplayer.roomError}
        botRecords={singlePlayer.botRecords}
        statistics={singlePlayer.statistics}
        replays={singlePlayer.replays}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onCreateRoom={multiplayer.createRoom}
        onJoinRoom={multiplayer.joinRoom}
        onSpectate={multiplayer.spectateRoom}
        onStartBot={singlePlayer.startGame}
        onOpenReplay={setReplay}
      />
    )
  }

  if (multiplayer.game.status === 'idle') {
    return <WaitingRoom connectionStatus={multiplayer.connectionStatus} connectedPlayers={multiplayer.connectedPlayers} error={multiplayer.roomError} inviteUrl={multiplayer.inviteUrl ?? ''} isHost={multiplayer.session.role === 'host'} roomCode={multiplayer.session.roomCode} roundsToPlay={multiplayer.series.roundsToPlay} />
  }

  const spectating = multiplayer.session.role === 'spectator'
  return (
    <GameView
      game={multiplayer.game}
      now={multiplayer.now}
      localPlayerId={multiplayer.localPlayerId ?? 'player1'}
      feedback={multiplayer.feedback}
      series={multiplayer.series}
      modeLabel={spectating ? `SPECTATING ${multiplayer.session.roomCode} - ${multiplayer.spectatorCount} VIEWERS` : `ONLINE ROOM - ${multiplayer.session.roomCode}`}
      canPlayAgain={multiplayer.session.role === 'host'}
      interactive={!spectating}
      soundEnabled={soundEnabled}
      onClaim={multiplayer.submitClaim}
      onFinalWord={multiplayer.submitFinalWord}
      onPowerUp={multiplayer.usePowerUp}
      onReportWord={reportWord}
      onPlayAgain={multiplayer.playAgain}
      onLeave={() => window.location.assign(window.location.pathname)}
    />
  )
}

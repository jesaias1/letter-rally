const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createRoomCode(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return [...bytes]
    .map((value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length])
    .join('')
}

export function normalizeRoomCode(value: string | null | undefined): string {
  return (value ?? '')
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, 16)
}

export function getRoomCodeFromUrl(): string {
  return normalizeRoomCode(new URLSearchParams(window.location.search).get('room'))
}

export function createInviteUrl(roomCode: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('room', roomCode)
  return url.toString()
}

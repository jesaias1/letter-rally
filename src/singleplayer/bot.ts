import { calculateScore, getWordValue } from '../game/scoring'
import type { LetterTile, PlayerState } from '../game/types'
import { canBuildWord, isValidClaimWord } from '../game/validation'

export type BotDifficulty = 'easy' | 'medium' | 'hard'

interface BotSettings {
  name: string
  claimChance: number
  reactionRange: [number, number]
  maximumClaimLength: number
  finalWordMinimumTiles: number
  finalWordDelay: number
}

export const BOT_SETTINGS: Record<BotDifficulty, BotSettings> = {
  easy: {
    name: 'Rookie Bot',
    claimChance: 0.45,
    reactionRange: [3_100, 4_200],
    maximumClaimLength: 5,
    finalWordMinimumTiles: 8,
    finalWordDelay: 3_200,
  },
  medium: {
    name: 'Rally Bot',
    claimChance: 0.76,
    reactionRange: [1_550, 2_350],
    maximumClaimLength: 7,
    finalWordMinimumTiles: 6,
    finalWordDelay: 1_650,
  },
  hard: {
    name: 'Ace Bot',
    claimChance: 0.98,
    reactionRange: [480, 850],
    maximumClaimLength: 12,
    finalWordMinimumTiles: 5,
    finalWordDelay: 650,
  },
}

const COMMON_BOT_WORDS = `
ABLE ABOUT ABOVE ACTOR AFTER AGAIN AGENT AGREE ALIVE ALLOW ALONE ALONG ANGER ANGLE APPLE ARGUE AVOID
BEACH BEGAN BEGIN BELOW BLACK BLAME BLIND BLOCK BLOOD BOARD BRAIN BREAD BREAK BRING BROWN BUILD
CARRY CATCH CAUSE CHAIN CHAIR CHASE CHEAP CHECK CHEST CHILD CHOICE CIVIL CLAIM CLASS CLEAN CLEAR CLIMB CLOCK CLOSE COAST COLOR COULD COUNT COVER CROSS CROWD
DANCE DEALT DEATH DOUBT DREAM DRINK DRIVE EARLY EARTH EIGHT ENJOY ENTER EXTRA
FAITH FALSE FAULT FIELD FIGHT FINAL FIRST FLOOR FOCUS FORCE FRAME FRESH FRONT FRUIT
GIANT GIVEN GLASS GLOBE GOING GRACE GRADE GRAND GRANT GRASS GREAT GREEN GROUP GROWN GUARD GUESS GUIDE
HAPPY HEART HEAVY HORSE HOTEL HOUSE HUMAN IDEAL IMAGE INDEX INNER INPUT IRON
JOINT JUDGE JUICE JUMP KNIFE KNOCK KNOWN LARGE LATER LAUGH LEARN LEAST LEAVE LIGHT LIMIT LOCAL LOOSE LUNCH
MAGIC MAJOR MAKER MARCH MATCH MAYBE METAL MIGHT MONEY MONTH MOUSE MOUTH MOVIE MUSIC
NEEDS NEVER NIGHT NORTH NOVEL NURSE OCEAN OFFER OFTEN ORDER OTHER OUTER OWNER
PAINT PANEL PAPER PARTY PEACE PHONE PIECE PILOT PLACE PLAIN PLANE PLANT PLATE POINT POWER PRESS PRICE PRIDE PRIME PRINT PROUD
QUEEN QUICK QUIET QUITE RADIO RAISE RANGE REACH READY RIGHT RIVER ROUGH ROUND ROUTE
SCALE SCENE SCOPE SCORE SHAPE SHARE SHARP SHEET SHELF SHIFT SHINE SHIRT SHOCK SHORT SIGHT SINCE SKILL SLEEP SMALL SMART SMILE SOLID SOUND SOUTH SPACE SPEAK SPEED SPEND SPORT STAGE STAND START STATE STEAM STEEL STICK STILL STOCK STONE STORE STORM STORY STUDY STYLE SUGAR SWEET
TABLE TAKEN TASTE TEACH THANK THEIR THEME THERE THICK THING THINK THIRD THOSE THROW TIGHT TIRED TITLE TODAY TOUCH TOUGH TOWER TRACK TRADE TRAIN TREAT TREND TRIAL TRUST TRUTH
UNDER UNION UNITY UNTIL UPPER URBAN VALUE VIDEO VISIT VITAL VOICE WASTE WATCH WATER WHEEL WHERE WHICH WHILE WHITE WHOLE WOMAN WORLD WORRY WORTH WOULD WRITE WRONG YOUNG YOUTH ZEBRA ZONES
`.trim().split(/\s+/)

const candidatesByLetter = new Map<string, string[]>()

function getCandidates(letter: string): string[] {
  const cached = candidatesByLetter.get(letter)
  if (cached) return cached

  const candidates = COMMON_BOT_WORDS.filter((word) => word.includes(letter))
  candidatesByLetter.set(letter, candidates)
  return candidates
}

export function getBotReactionDelay(
  difficulty: BotDifficulty,
  random: () => number = Math.random,
): number {
  const [minimum, maximum] = BOT_SETTINGS[difficulty].reactionRange
  return Math.round(minimum + (maximum - minimum) * random())
}

export function chooseBotClaimWord(
  displayedLetter: string,
  player: PlayerState,
  difficulty: BotDifficulty,
  random: () => number = Math.random,
): string | undefined {
  const settings = BOT_SETTINGS[difficulty]
  if (random() > settings.claimChance) return undefined

  const validWords = getCandidates(displayedLetter).filter(
    (word) =>
      word.length <= settings.maximumClaimLength &&
      isValidClaimWord(word, displayedLetter, player).valid,
  )
  if (!validWords.length) return undefined

  if (difficulty === 'hard') {
    return validWords.reduce((best, word) => {
      const score = getWordValue(word) + word.length * 2
      const bestScore = getWordValue(best) + best.length * 2
      return score > bestScore ? word : best
    })
  }

  return validWords[Math.floor(random() * validWords.length)]
}

export function chooseBotFinalWord(board: LetterTile[]): string | undefined {
  return COMMON_BOT_WORDS
    .filter((word) => word.length >= 5 && word.length <= board.length && canBuildWord(word, board))
    .reduce<string | undefined>((best, word) => {
      if (!best) return word
      const score = calculateScore(board, word).total
      const bestScore = calculateScore(board, best).total
      return score > bestScore || (score === bestScore && word.length > best.length) ? word : best
    }, undefined)
}

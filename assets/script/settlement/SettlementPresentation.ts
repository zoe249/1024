import type { LeaderboardEntryDto, SettlementRank } from '../online/api/GameApiClient'

export const SETTLEMENT_ROW_STEP = 96
export const SETTLEMENT_LIST_HEIGHT = 500

export const formatSettlementScore = (value: number) => Math.max(0, Math.floor(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export type SettlementTrack = {
  result: SettlementRank
  entries: Array<{ entry: LeaderboardEntryDto; baseRank: number }>
  start: number
  end: number
  moving: boolean
  landing: number
  celebrationDuration: number
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))
export const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }

/** 用真实条目的顺序压缩长距离，省略中段名次但不编造玩家。 */
export function buildSettlementTrack(result: SettlementRank): SettlementTrack {
  const current = result.current ?? 0
  const seen = new Set<number>()
  const entries = (result.entries ?? []).filter(entry => {
    if (entry.isSelf || !entry.rank || entry.rank === current || seen.has(entry.rank)) return false
    seen.add(entry.rank)
    return true
  }).sort((a, b) => a.rank! - b.rank!).map(entry => ({ entry, baseRank: entry.rank! - (entry.rank! > current ? 1 : 0) }))
  const position = (rank: number) => entries.filter(row => row.baseRank < rank).length
  const moving = result.previous !== null && result.previous > current && current > 0 && entries.length > 0 && result.celebrate !== false
  const first = result.previous === null && current > 0 && result.celebrate !== false
  return {
    result, entries, start: position(moving ? result.previous! : current), end: position(current), moving,
    landing: moving ? 630 + (result.previous! - current > 30 ? 2100 : 1950) : 450,
    celebrationDuration: moving ? (current === 1 ? 3000 : 2600) : first ? 1900 : 0
  }
}

export function settlementFrame(track: SettlementTrack, milliseconds: number) {
  const { result, entries, start, end, landing, moving } = track
  const progress = moving ? clamp((milliseconds - 630) / (landing - 630)) : 1
  const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2
  const position = moving ? start + (end - start) * eased : end
  const startSlot = Math.min(4, start)
  const endSlot = result.current === 1 ? 0 : Math.min(1, end)
  const slot = moving ? startSlot + (endSlot - startSlot) * eased : endSlot
  const camera = Math.max(0, position - slot)
  const low = Math.floor(position)
  const leftRank = entries[low]?.baseRank ?? (entries[entries.length - 1]?.baseRank ?? 0) + 1
  const rightRank = entries[low + 1]?.baseRank ?? leftRank + 1
  const rank = milliseconds >= landing || !moving ? result.current
    : Math.min(result.previous!, Math.max(result.current!, Math.ceil(leftRank + (rightRank - leftRank) * (position - low))))
  const charge = moving && milliseconds >= 450 && milliseconds < 630 ? Math.sin((milliseconds - 450) / 180 * Math.PI) : 0
  const bounce = moving && milliseconds >= landing && milliseconds < landing + 340 ? Math.sin((milliseconds - landing) / 340 * Math.PI) : 0
  return {
    rank, position, camera,
    selfY: SETTLEMENT_LIST_HEIGHT / 2 - SETTLEMENT_ROW_STEP / 2 - (position - camera) * SETTLEMENT_ROW_STEP - charge * 8,
    selfScale: 1 + charge * 0.018 + bounce * 0.035,
    celebrationElapsed: milliseconds - landing,
    done: milliseconds >= landing + Math.max(moving ? 340 : 0, track.celebrationDuration),
    rows: entries.map((row, index) => ({
      ...row, index,
      rank: row.baseRank + (position <= index ? 1 : 0),
      crossing: Math.sin(smooth(index + 1 - position) * Math.PI),
      y: SETTLEMENT_LIST_HEIGHT / 2 - SETTLEMENT_ROW_STEP / 2 - (index + smooth(index + 1 - position) - camera) * SETTLEMENT_ROW_STEP
    }))
  }
}

export type CelebrationParticle = { delay: number; life: number; x: number; vx: number; vy: number; gravity: number; spin: number; phase: number; width: number; height: number; color: number; kind: number }

export function makeCelebration(top: boolean, first: boolean): CelebrationParticle[] {
  let seed = 9271
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const count = first ? 36 : top ? 144 : 96
  const waves = first ? 1 : top ? 3 : 2
  const duration = first ? 1900 : top ? 3000 : 2600
  return Array.from({ length: count }, (_, index) => {
    const side = index % 2 ? -1 : 1
    const delay = Math.floor(index / (count / waves)) * 180 + random() * 70
    return {
      delay, life: Math.min(duration - delay, 1550 + random() * (first ? 300 : top ? 1000 : 700)),
      x: side * -365, vx: side * (80 + random() * 290),
      vy: (first ? 1200 : top ? 1620 : 1460) + random() * 400,
      gravity: 1220 + random() * 160, spin: (random() - 0.5) * 15, phase: random() * Math.PI * 2,
      width: 8 + random() * 9, height: 5 + random() * 7, color: index % 5, kind: random()
    }
  })
}

export function particleFrame(particle: CelebrationParticle, milliseconds: number) {
  const age = milliseconds - particle.delay
  if (age < 0 || age >= particle.life) return null
  const t = age / 1000
  return {
    x: particle.x + particle.vx * t + Math.sin(particle.phase + t * 8) * 9,
    y: -550 + particle.vy * t - 0.5 * particle.gravity * t * t,
    angle: particle.phase + particle.spin * t,
    flip: Math.max(0.15, Math.abs(Math.cos(particle.phase + t * 11))),
    alpha: Math.min(1, age / 65, (particle.life - age) / (particle.life * 0.22))
  }
}

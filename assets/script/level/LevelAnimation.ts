// 与无尽模式保持相同的动作曲线，独立维护，避免闯关依赖其玩法脚本。
const clamp = (value: number) => Math.max(0, Math.min(1, value))
export const sineOut = (t: number) => Math.sin(clamp(t) * Math.PI / 2)
export const sineInOut = (t: number) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2
export const quadOut = (t: number) => 1 - (1 - clamp(t)) ** 2
export const LEVEL_MERGE_DURATION = .41
export const LEVEL_GRAVITY_DURATION = .09
export const LEVEL_DROP_SPEED = 5000

/** 原地消除：微小错帧、舒展、上浮2.5%格宽并淡出，不向锚点移动。 */
export function sampleLevelClear(elapsed: number, index: number, pieceSize: number) {
  const time = elapsed - Math.min(index, 3) * .012
  if (time <= 0) return { scale: 1, opacity: 255, rise: 0, shattered: false }
  if (time < .055) return { scale: 1 + .04 * sineOut(time / .055), opacity: 255, rise: 0, shattered: false }
  const t = sineInOut((time - .055) / .18)
  return { scale: 1.04 + (.62 - 1.04) * t, opacity: 255 * (1 - t), rise: pieceSize * .025 * t, shattered: true }
}

/** 消除开始0.1秒后升级，与周围棋子消失重叠，三段舒展回弹。 */
export function sampleLevelUpgrade(elapsed: number) {
  const time = elapsed - .1
  if (time < 0) return { upgraded: false, scale: 1 }
  if (time < .13) return { upgraded: true, scale: 1 + .1 * sineOut(time / .13) }
  if (time < .245) return { upgraded: true, scale: 1.1 + (.995 - 1.1) * sineInOut((time - .13) / .115) }
  return { upgraded: true, scale: .995 + .005 * sineOut((time - .245) / .065) }
}

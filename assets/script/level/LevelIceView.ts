import { _decorator, Color, Component, Graphics, Node } from 'cc'

const { ccclass, property, executeInEditMode } = _decorator
type Shard = { x: number; y: number; vx: number; vy: number; radius: number; angle: number; spin: number; hits: number; rest: boolean }

@ccclass('LevelIceView')
@executeInEditMode
export class LevelIceView extends Component {
  @property({ type: Node }) shell: Node = null!
  @property({ type: Graphics }) facets: Graphics = null!
  @property({ type: Graphics }) fragments: Graphics = null!
  paused = false
  private shards: Shard[] = []
  private elapsed = -1
  private floor = -60
  private settledAt = -1
  get breaking() { return this.elapsed >= 0 }

  onLoad() { this.drawFacets(false) }

  private polygon(g: Graphics, points: number[][], color: Color) {
    g.fillColor = color; g.moveTo(points[0][0], points[0][1])
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1])
    g.close(); g.fill()
  }

  private drawFacets(cracked: boolean) {
    const g = this.facets
    if (!g?.isValid) return
    g.clear()
    this.polygon(g, [[-51, 32], [-29, 52], [-9, 46], [-31, 28]], new Color(216, 250, 255, 160))
    this.polygon(g, [[-51, -27], [-35, -50], [-24, -34], [-41, -9]], new Color(78, 166, 199, 130))
    this.polygon(g, [[51, 29], [28, 50], [32, 22], [50, 4]], new Color(160, 227, 245, 190))
    this.polygon(g, [[15, -48], [49, -33], [40, -13], [25, -29]], new Color(201, 244, 250, 190))
    g.lineWidth = 1.8; g.strokeColor = new Color(225, 252, 255, 210)
    for (const [x, y, s] of [[-25, 24, 1], [27, -25, -1]]) {
      g.moveTo(x, y); g.lineTo(x + 8 * s, y + 15 * s); g.lineTo(x + 18 * s, y + 20 * s); g.stroke()
      g.moveTo(x + 8 * s, y + 15 * s); g.lineTo(x + 5 * s, y + 25 * s); g.stroke()
    }
    g.fillColor = new Color(215, 248, 255, 170)
    for (const [x, y, r] of [[28, -30, 2], [33, -21, 3], [-26, 33, 2]]) { g.circle(x, y, r); g.fill() }
    if (cracked) {
      g.strokeColor = new Color('#2B7198'); g.lineWidth = 2.5
      for (const [x, y] of [[-48, 34], [16, 51], [50, -21], [-31, -49]]) {
        g.moveTo(0, 0); g.lineTo(x * .42, y * .35); g.lineTo(x * .58 - 5, y * .66); g.lineTo(x, y); g.stroke()
      }
    }
  }

  playBreak(floorY: number) {
    if (this.elapsed >= 0) return
    this.floor = floorY; this.elapsed = 0
    this.drawFacets(true)
    this.shards = Array.from({ length: 8 }, (_, i) => ({
      x: Math.cos(i * Math.PI / 4) * 43, y: Math.sin(i * Math.PI / 4) * 43,
      vx: Math.cos(i * Math.PI / 4) * (65 + i * 4), vy: 125 + (i % 3) * 38,
      radius: 7 + (i % 3) * 3, angle: i, spin: i % 2 ? 3 : -3, hits: 0, rest: false
    }))
  }

  /** 分步积分避免低帧率穿地；碎片落稳后保持位置和尺寸，停留0.8秒再淡出。 */
  update(dt: number) {
    if (this.elapsed < 0 || this.paused) return
    this.elapsed += dt
    if (this.elapsed < .13) return
    if (this.shell?.isValid) this.shell.active = false
    const steps = Math.max(1, Math.ceil(Math.min(dt, .1) / (1 / 120)))
    const step = Math.min(dt, .1) / steps
    for (let i = 0; i < steps; i++) for (const shard of this.shards) {
      if (shard.rest) continue
      shard.vy -= 1100 * step; shard.x += shard.vx * step; shard.y += shard.vy * step; shard.angle += shard.spin * step
      if (shard.y - shard.radius <= this.floor && shard.vy < 0) {
        shard.y = this.floor + shard.radius; shard.vy = -shard.vy * .26; shard.vx *= .58; shard.spin *= .5; shard.hits++
        if (shard.hits >= 2 || shard.vy < 70) { shard.rest = true; shard.vx = shard.vy = shard.spin = 0 }
      }
    }
    if (this.settledAt < 0 && this.shards.every(shard => shard.rest)) this.settledAt = this.elapsed
    const alpha = this.settledAt < 0 ? 1 : 1 - Math.max(0, Math.min(1, (this.elapsed - this.settledAt - .8) / .5))
    const g = this.fragments
    if (!g?.isValid) return
    g.clear()
    if (alpha <= 0) { this.node.destroy(); return }
    for (const shard of this.shards) {
      const height = Math.max(0, shard.y - this.floor - shard.radius)
      g.fillColor = new Color(40, 78, 70, Math.round(35 * alpha * Math.max(.15, 1 - height / 400)))
      g.ellipse(shard.x, this.floor - 1, shard.radius * 1.2, 2); g.fill()
      const points = [[-1, -.7], [.4, -1], [1, .1], [.2, .9], [-.7, .6]].map(([x, y]) => [
        shard.x + (x * Math.cos(shard.angle) - y * Math.sin(shard.angle)) * shard.radius,
        shard.y + (x * Math.sin(shard.angle) + y * Math.cos(shard.angle)) * shard.radius
      ])
      this.polygon(g, points, new Color(91, 186, 221, Math.round(alpha * 255)))
      this.polygon(g, [points[0], points[1], [shard.x, shard.y], points[4]], new Color(199, 245, 255, Math.round(alpha * 255)))
    }
  }
}

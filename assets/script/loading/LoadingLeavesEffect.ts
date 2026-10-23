// 独立拥有飘叶的节点与模拟时钟，宿主只调用 initialize、update 和 dispose。
import { Color, Node, Sprite, SpriteFrame, Tween, UIOpacity, UITransform, Vec3 } from 'cc'

const LEAF_COUNT = 24

type WindPath = {
  start: Vec3
  controlA: Vec3
  controlB: Vec3
  end: Vec3
}

type LeafParticle = {
  node: Node
  opacity: UIOpacity
  pathIndex: number
  progress: number
  speed: number
  sway: number
  phase: number
  baseScale: number
  baseRotation: number
  angularVelocity: number
}

export class LoadingLeavesEffect {
  private readonly leafParticles: LeafParticle[] = []
  private randomState = 1024
  private elapsedSeconds = 0
  private disposed = false

  private readonly windPaths: ReadonlyArray<WindPath> = [
    {
      start: new Vec3(430, 610, 0),
      controlA: new Vec3(110, 500, 0),
      controlB: new Vec3(70, -130, 0),
      end: new Vec3(-430, -560, 0)
    },
    {
      start: new Vec3(440, 330, 0),
      controlA: new Vec3(160, 230, 0),
      controlB: new Vec3(-130, -70, 0),
      end: new Vec3(-430, -310, 0)
    }
  ]

  constructor(private readonly leafLayer: Node, private readonly leafSpriteFrame: SpriteFrame | null) {}

  initialize() { this.createLeafParticles() }

  update(deltaTime: number) {
    if (this.disposed) return
    const safeDeltaTime = Math.min(deltaTime, 0.05)
    this.elapsedSeconds += safeDeltaTime
    this.updateLeafParticles(safeDeltaTime)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    for (const particle of this.leafParticles) {
      if (!particle.node.isValid) continue
      Tween.stopAllByTarget(particle.node)
      if (particle.opacity.isValid) Tween.stopAllByTarget(particle.opacity)
      particle.node.destroy()
    }
    this.leafParticles.length = 0
  }

  private createLeafParticles() {
    if (!this.leafLayer || !this.leafSpriteFrame || this.leafParticles.length > 0) {
      return
    }

    const leafColors = [
      new Color(255, 255, 255, 255),
      new Color(226, 255, 190, 255),
      new Color(255, 242, 160, 255),
      new Color(208, 238, 154, 255)
    ]

    for (let index = 0; index < LEAF_COUNT; index += 1) {
      const node = new Node(`WindLeaf_${index}`)
      node.setParent(this.leafLayer)
      const transform = node.addComponent(UITransform)
      transform.setContentSize(52, 56)
      const sprite = node.addComponent(Sprite)
      sprite.spriteFrame = this.leafSpriteFrame
      sprite.type = Sprite.Type.SIMPLE
      sprite.sizeMode = Sprite.SizeMode.CUSTOM
      sprite.color = leafColors[index % leafColors.length]
      const opacity = node.addComponent(UIOpacity)

      const particle: LeafParticle = {
        node,
        opacity,
        pathIndex: index % this.windPaths.length,
        progress: (index / LEAF_COUNT + this.random() * 0.08) % 1,
        speed: 0.13 + this.random() * 0.09,
        sway: 8 + this.random() * 20,
        phase: this.random() * Math.PI * 2,
        baseScale: 0.5 + this.random() * 0.72,
        baseRotation: this.random() * 360,
        angularVelocity: (this.random() > 0.5 ? 1 : -1) * (70 + this.random() * 150)
      }
      this.leafParticles.push(particle)
      this.placeLeafParticle(particle)
    }
  }

  private updateLeafParticles(deltaTime: number) {
    for (const particle of this.leafParticles) {
      particle.progress += particle.speed * deltaTime
      if (particle.progress >= 1) {
        particle.progress -= 1
        particle.pathIndex = (particle.pathIndex + 1) % this.windPaths.length
      }
      this.placeLeafParticle(particle)
    }
  }

  private placeLeafParticle(particle: LeafParticle) {
    const path = this.windPaths[particle.pathIndex]
    const progress = particle.progress
    const position = this.cubicBezier(path, progress)
    const tangent = this.cubicBezierTangent(path, progress)
    const tangentLength = Math.max(0.001, Math.hypot(tangent.x, tangent.y))
    const normalX = -tangent.y / tangentLength
    const normalY = tangent.x / tangentLength
    const wave = Math.sin(progress * Math.PI * 5 + particle.phase) * particle.sway
    particle.node.setPosition(position.x + normalX * wave, position.y + normalY * wave, 0)

    const pulse = 1 + Math.sin(progress * Math.PI * 4 + particle.phase) * 0.08
    const scale = particle.baseScale * pulse
    particle.node.setScale(scale, scale, 1)
    particle.node.angle = particle.baseRotation + this.elapsedSeconds * particle.angularVelocity

    // 路径首尾淡入淡出，循环回到起点时不会产生跳闪。
    const edgeFade = Math.min(1, progress * 10, (1 - progress) * 10)
    particle.opacity.opacity = Math.round(255 * edgeFade)
  }

  private cubicBezier(path: WindPath, progress: number) {
    const inverse = 1 - progress
    const inverseSquared = inverse * inverse
    const progressSquared = progress * progress
    return new Vec3(
      inverseSquared * inverse * path.start.x
        + 3 * inverseSquared * progress * path.controlA.x
        + 3 * inverse * progressSquared * path.controlB.x
        + progressSquared * progress * path.end.x,
      inverseSquared * inverse * path.start.y
        + 3 * inverseSquared * progress * path.controlA.y
        + 3 * inverse * progressSquared * path.controlB.y
        + progressSquared * progress * path.end.y,
      0
    )
  }

  private cubicBezierTangent(path: WindPath, progress: number) {
    const inverse = 1 - progress
    return new Vec3(
      3 * inverse * inverse * (path.controlA.x - path.start.x)
        + 6 * inverse * progress * (path.controlB.x - path.controlA.x)
        + 3 * progress * progress * (path.end.x - path.controlB.x),
      3 * inverse * inverse * (path.controlA.y - path.start.y)
        + 6 * inverse * progress * (path.controlB.y - path.controlA.y)
        + 3 * progress * progress * (path.end.y - path.controlB.y),
      0
    )
  }

  private random() {
    this.randomState = (this.randomState * 1664525 + 1013904223) >>> 0
    return this.randomState / 0x100000000
  }

}

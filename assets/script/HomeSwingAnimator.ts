import { _decorator, Component, Node, UIOpacity, UITransform } from 'cc'

const { ccclass } = _decorator

type HomeSwingAnimatorOptions = {
  leftRope: Node
  rightRope: Node
  seatRoot: Node
  bird: Node
  leaves: Node[]
}

type LeafMotion = {
  node: Node
  opacity: UIOpacity
  startX: number
  startY: number
  driftX: number
  driftY: number
  duration: number
  offset: number
  scale: number
}

type SeatPose = {
  centerX: number
  centerY: number
  leftBottomX: number
  leftBottomY: number
  rightBottomX: number
  rightBottomY: number
}

const FULL_CIRCLE = Math.PI * 2
const RAD_TO_DEG = 180 / Math.PI
const SWING_PERIOD = 3.6
const SWING_MAX_SEAT_ANGLE = 4.8 * Math.PI / 180
const SWING_ROPE_LENGTH = 335

// 挂点使用 750 × 1625 的背景局部坐标，与背景图上的两个固定绳结对齐。
const LEFT_ANCHOR_X = -43
const RIGHT_ANCHOR_X = 48
const ANCHOR_Y = 105
const SEAT_ATTACH_X = 102
const SEAT_ATTACH_Y = 28

const LEAF_MOTIONS = [
  { startX: 146, startY: 78, driftX: 72, driftY: 270, duration: 5.4, offset: 0, scale: 0.76 },
  { startX: 184, startY: 38, driftX: -58, driftY: 236, duration: 6.2, offset: 0.34, scale: 0.58 },
  { startX: -154, startY: 54, driftX: 96, driftY: 248, duration: 6.8, offset: 0.67, scale: 0.68 }
] as const

/**
 * 首页树枝秋千的纯表现组件。
 *
 * 背景和树枝保持静止；座板沿钟摆圆弧运动，两根绳子每帧连接固定挂点与座板，
 * 避免旋转整个秋千节点时把树枝挂点一起带走。
 */
@ccclass('HomeSwingAnimator')
export class HomeSwingAnimator extends Component {
  private leftRope: Node | null = null
  private rightRope: Node | null = null
  private seatRoot: Node | null = null
  private bird: Node | null = null
  private leafMotions: LeafMotion[] = []
  private elapsed = 0
  private configured = false
  private readonly seatPose: SeatPose = {
    centerX: 0,
    centerY: 0,
    leftBottomX: 0,
    leftBottomY: 0,
    rightBottomX: 0,
    rightBottomY: 0
  }

  public setup(options: HomeSwingAnimatorOptions) {
    this.leftRope = options.leftRope
    this.rightRope = options.rightRope
    this.seatRoot = options.seatRoot
    this.bird = options.bird
    this.leafMotions = options.leaves.slice(0, LEAF_MOTIONS.length).map((node, index) => {
      const config = LEAF_MOTIONS[index]
      return {
        node,
        opacity: node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity),
        ...config
      }
    })
    this.elapsed = 0
    this.configured = true
    this.renderFrame()
  }

  update(deltaTime: number) {
    if (!this.configured) {
      return
    }

    // 预览窗口切回前台时限制单帧步长，避免动画瞬移。
    this.elapsed += Math.min(Math.max(deltaTime, 0), 0.1)
    this.renderFrame()
  }

  private renderFrame() {
    if (!this.leftRope?.isValid || !this.rightRope?.isValid || !this.seatRoot?.isValid || !this.bird?.isValid) {
      return
    }

    const phase = this.elapsed * FULL_CIRCLE / SWING_PERIOD
    const seatAngle = SWING_MAX_SEAT_ANGLE * Math.sin(phase)
    const seatAngleDegrees = seatAngle * RAD_TO_DEG
    const angularVelocity = SWING_MAX_SEAT_ANGLE * FULL_CIRCLE / SWING_PERIOD * Math.cos(phase)
    if (!this.solveSeatPose(seatAngle)) {
      return
    }

    this.seatRoot.setPosition(this.seatPose.centerX, this.seatPose.centerY, 0)
    this.seatRoot.angle = seatAngleDegrees

    this.updateRope(
      this.leftRope,
      LEFT_ANCHOR_X,
      ANCHOR_Y,
      this.seatPose.leftBottomX,
      this.seatPose.leftBottomY
    )
    this.updateRope(
      this.rightRope,
      RIGHT_ANCHOR_X,
      ANCHOR_Y,
      this.seatPose.rightBottomX,
      this.seatPose.rightBottomY
    )

    const breathing = 1 + Math.sin(this.elapsed * 3.6) * 0.012
    const speedRatio = Math.abs(Math.cos(phase))
    this.bird.setScale(breathing + speedRatio * 0.004, breathing - speedRatio * 0.003, 1)
    // 小鸟反向抵消大部分座板倾角，并对速度保留极轻微惯性延迟。
    this.bird.angle = -seatAngleDegrees * 0.72 - angularVelocity * RAD_TO_DEG * 0.055

    this.updateLeaves()
  }

  /**
   * 根据固定绳长和刚性座板计算四连杆的下方交点。
   * 两个圆心分别由树枝挂点减去旋转后的座板挂点得到，取下方交点即可保证双绳全程不伸缩。
   */
  private solveSeatPose(seatAngle: number) {
    const cosine = Math.cos(seatAngle)
    const sine = Math.sin(seatAngle)
    const leftLocalX = -SEAT_ATTACH_X * cosine - SEAT_ATTACH_Y * sine
    const leftLocalY = -SEAT_ATTACH_X * sine + SEAT_ATTACH_Y * cosine
    const rightLocalX = SEAT_ATTACH_X * cosine - SEAT_ATTACH_Y * sine
    const rightLocalY = SEAT_ATTACH_X * sine + SEAT_ATTACH_Y * cosine
    const leftCircleX = LEFT_ANCHOR_X - leftLocalX
    const leftCircleY = ANCHOR_Y - leftLocalY
    const rightCircleX = RIGHT_ANCHOR_X - rightLocalX
    const rightCircleY = ANCHOR_Y - rightLocalY
    const centerDeltaX = rightCircleX - leftCircleX
    const centerDeltaY = rightCircleY - leftCircleY
    const centerDistance = Math.hypot(centerDeltaX, centerDeltaY)
    const halfDistance = centerDistance * 0.5

    if (centerDistance <= 0.001 || halfDistance >= SWING_ROPE_LENGTH) {
      return false
    }

    const intersectionHeight = Math.sqrt(
      SWING_ROPE_LENGTH * SWING_ROPE_LENGTH - halfDistance * halfDistance
    )
    const middleX = (leftCircleX + rightCircleX) * 0.5
    const middleY = (leftCircleY + rightCircleY) * 0.5
    // centerDelta 在静止时朝左，因此该法向量稳定指向画面下方。
    const perpendicularX = -centerDeltaY / centerDistance
    const perpendicularY = centerDeltaX / centerDistance

    this.seatPose.centerX = middleX + perpendicularX * intersectionHeight
    this.seatPose.centerY = middleY + perpendicularY * intersectionHeight
    this.seatPose.leftBottomX = this.seatPose.centerX + leftLocalX
    this.seatPose.leftBottomY = this.seatPose.centerY + leftLocalY
    this.seatPose.rightBottomX = this.seatPose.centerX + rightLocalX
    this.seatPose.rightBottomY = this.seatPose.centerY + rightLocalY
    return true
  }

  /** 让竖向绳子 Sprite 始终精确连接固定挂点与座板连接点。 */
  private updateRope(rope: Node, topX: number, topY: number, bottomX: number, bottomY: number) {
    const deltaX = bottomX - topX
    const deltaY = bottomY - topY
    const length = Math.hypot(deltaX, deltaY)
    const transform = rope.getComponent(UITransform)

    rope.setPosition((topX + bottomX) * 0.5, (topY + bottomY) * 0.5, 0)
    rope.angle = Math.atan2(deltaX, -deltaY) * RAD_TO_DEG
    transform?.setContentSize(transform.width, length)
  }

  /** 复用三片叶子形成错峰循环，首尾均在透明状态下重置，避免跳帧。 */
  private updateLeaves() {
    for (const motion of this.leafMotions) {
      if (!motion.node.isValid || !motion.opacity.isValid) {
        continue
      }

      const progress = (this.elapsed / motion.duration + motion.offset) % 1
      const wave = Math.sin((progress * 2.2 + motion.offset) * FULL_CIRCLE)
      const x = motion.startX + motion.driftX * progress + wave * 18
      const y = motion.startY - motion.driftY * progress + Math.sin(progress * FULL_CIRCLE) * 7
      const fadeIn = Math.min(1, progress / 0.12)
      const fadeOut = Math.min(1, (1 - progress) / 0.18)

      motion.node.setPosition(x, y, 0)
      motion.node.angle = progress * 330 + motion.offset * 120
      motion.node.setScale(motion.scale, motion.scale, 1)
      motion.opacity.opacity = Math.round(220 * Math.min(fadeIn, fadeOut))
    }
  }
}

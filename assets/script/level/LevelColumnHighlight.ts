import { _decorator, Color, Component, Graphics, UITransform } from 'cc'

const { ccclass, executeInEditMode, property } = _decorator
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }

/** 无描边的暖白列光带；原生顶点透明度渐隐，不拉伸棋子贴图，也不新增位图资源。 */
@ccclass('LevelColumnHighlight')
@executeInEditMode
export class LevelColumnHighlight extends Component {
  @property({ type: Color }) tint = new Color(255, 252, 235, 112)
  private drawKey = ''

  onEnable() {
    const transform = this.getComponent(UITransform), graphics = this.getComponent(Graphics)
    if (!transform || !graphics) return
    const { width, height } = transform
    const { r, g, b, a } = this.tint
    const key = `${width}:${height}:${r}:${g}:${b}:${a}`
    if (key === this.drawKey) return
    this.drawKey = key
    graphics.clear()
    if (width <= 0 || height <= 0) return
    // 网格只在尺寸／颜色变化时生成一次，按住及拖动期间复用同一份几何。
    const columns = 24, rows = 64, dx = width / columns, dy = height / rows
    for (let row = 0; row < rows; row++) {
      const y = (row + .5) * dy
      const endFade = smooth(Math.min(y, height - y) / (height * .14))
      for (let column = 0; column < columns; column++) {
        const x = (column + .5) * dx
        const sideFade = smooth(Math.min(x, width - x) / (width * .22))
        const alpha = Math.round(a * endFade * sideFade)
        if (!alpha) continue
        graphics.fillColor = new Color(r, g, b, alpha)
        graphics.rect(-width / 2 + column * dx, -height / 2 + row * dy, dx, dy)
        graphics.fill()
      }
    }
  }
}

import { Node, Tween, UIOpacity } from 'cc'

// 统一登记临时特效节点，便于返回首页、重开或超量时做收口清理。
export class TransientFxRegistry {
  private readonly activeNodes = new Set<Node>()

  constructor(private readonly maxActiveCount: number) {}

  canRegister(count: number) {
    return this.activeNodes.size + count <= this.maxActiveCount
  }

  register(node: Node) {
    this.activeNodes.add(node)
  }

  // 特效自然结束时从集合移除并销毁节点，避免集合里残留无效引用。
  destroy(node: Node) {
    this.activeNodes.delete(node)
    node.destroy()
  }

  /**
   * 停止并清理所有运行中临时特效。
   *
   * 返回首页、重开或落地前清理拖尾时都会调用这里；清理时会同步停止节点和透明度组件上的 Tween，
   * 避免节点销毁后仍有动画回调访问旧对象。
   */
  clear() {
    for (const node of this.activeNodes) {
      Tween.stopAllByTarget(node)
      const opacity = node.getComponent(UIOpacity)
      if (opacity) {
        Tween.stopAllByTarget(opacity)
      }
      node.destroy()
    }
    this.activeNodes.clear()
  }
}

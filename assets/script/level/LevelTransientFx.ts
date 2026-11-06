import { Node, Tween, UIOpacity } from 'cc'

// 闯关拥有自己的临时特效登记与暂停，不控制无尽模式节点。
export class LevelTransientFx {
  private nodes: Node[] = []

  constructor(private readonly maxCount: number) {}

  canRegister(count: number) { return this.nodes.length + count <= this.maxCount }
  register(node: Node) { this.nodes.push(node) }

  destroy(node: Node) {
    this.nodes = this.nodes.filter(item => item !== node)
    if (!node?.isValid) return
    this.visit(node, target => Tween.stopAllByTarget(target))
    node.destroy()
  }

  setPaused(paused: boolean) {
    for (const node of this.nodes) this.visit(node, target => {
      if (paused) Tween.pauseAllByTarget(target)
      else Tween.resumeAllByTarget(target)
    })
  }

  clear() {
    const nodes = this.nodes
    this.nodes = []
    for (const node of nodes) {
      if (!node?.isValid) continue
      this.visit(node, target => Tween.stopAllByTarget(target))
      node.destroy()
    }
  }

  private visit(node: Node, callback: (target: object) => void) {
    if (!node?.isValid) return
    callback(node)
    const opacity = node.getComponent(UIOpacity)
    if (opacity?.isValid) callback(opacity)
    for (const child of node.children) this.visit(child, callback)
  }
}

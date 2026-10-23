// 只拥有解析结果与资源租约；loading 的待进入槽不保存节点，交接可取消且只接管一次。
import { AppearanceAssetLoader, appearanceAssetLoader, type AppearanceAssetLease } from './AppearanceAssetLoader'
import { BASE_APPEARANCE } from './BaseAppearance'
import { findAppearanceTheme } from './AppearanceCatalog'
import { resolveAppearance } from './AppearanceResolver'
import { appearanceAssetKey, sceneAppearanceAssets, type AppearanceAssetRef, type AppearanceScene, type ResolvedAppearance } from './AppearanceTypes'
import type { Asset } from 'cc'

type Shared = { appearance: ResolvedAppearance; scene: AppearanceScene; owners: number; assets: Map<string, AppearanceAssetLease> }
export class AppearanceLease {
  private released = false
  constructor(private readonly shared: Shared) {}
  get appearance() { return this.shared.appearance }
  get scene() { return this.shared.scene }
  get isReleased() { return this.released }
  asset(ref: AppearanceAssetRef): Asset | null { return this.released ? null : this.shared.assets.get(appearanceAssetKey(ref))?.asset ?? null }

  retain() {
    if (this.released) throw new Error('外观租约已释放')
    this.shared.owners += 1
    return new AppearanceLease(this.shared)
  }

  transfer() {
    if (this.released) throw new Error('外观租约已转移或释放')
    this.released = true
    return new AppearanceLease(this.shared)
  }

  release() {
    if (this.released) return
    this.released = true
    if (--this.shared.owners !== 0) return
    for (const asset of this.shared.assets.values()) asset.release()
    this.shared.assets.clear()
  }
}

export class AppearanceRuntime {
  private generation = 0
  private pendingGame: { ticket: number; target: string; lease: AppearanceLease } | null = null
  constructor(private readonly loader: AppearanceAssetLoader = appearanceAssetLoader) {}

  // Base 首帧沿用 Scene/Prefab 引用及原按需加载时机，不因架构接入增加等待。
  acquireBase(scene: AppearanceScene) { return new AppearanceLease({ appearance: BASE_APPEARANCE, scene, owners: 1, assets: new Map() }) }

  prepare(scene: AppearanceScene, themeId = 'base') { return this.prepareResolved(scene, resolveAppearance(findAppearanceTheme(themeId))) }

  /** 候选资源全部成功才交付租约；取消立即结束等待，失败整体释放，不显示半套覆盖。 */
  prepareResolved(scene: AppearanceScene, appearance: ResolvedAppearance) {
    const assets = new Map<string, AppearanceAssetLease>()
    for (const ref of appearance.themeId === 'base' ? [] : sceneAppearanceAssets(appearance, scene)) {
      if (ref.source === 'binding') continue
      const key = appearanceAssetKey(ref)
      if (!assets.has(key)) assets.set(key, this.loader.acquire(ref))
    }
    const lease = new AppearanceLease({ appearance, scene, owners: 1, assets })
    let finished = false
    let resolve!: (result: { status: 'ready'; lease: AppearanceLease } | { status: 'failed'; error: Error } | { status: 'cancelled' }) => void
    const ready = new Promise<Parameters<typeof resolve>[0]>(done => { resolve = done })
    for (const request of assets.values()) request.ready.then(result => {
      if (finished || result.status === 'ready') return
      finished = true
      lease.release()
      resolve(result)
    })
    Promise.all([...assets.values()].map(asset => asset.ready)).then(results => {
      if (finished) return
      finished = true
      const failed = results.find(result => result.status !== 'ready')
      if (failed) { lease.release(); resolve(failed.status === 'failed' ? failed : { status: 'cancelled' }) }
      else resolve({ status: 'ready', lease })
    })
    return { ready, cancel: () => { if (finished) return; finished = true; lease.release(); resolve({ status: 'cancelled' }) } }
  }

  handoffGame(lease: AppearanceLease, target: string) {
    if (lease.scene !== 'game') throw new Error('只能交接游戏外观')
    const transferred = lease.transfer()
    this.discardPendingGame()
    const ticket = ++this.generation
    this.pendingGame = { ticket, target, lease: transferred }
    return ticket
  }

  getGameTicket(target: string) { return this.pendingGame?.target === target ? this.pendingGame.ticket : null }

  takeGame(ticket: number, target: string) {
    if (!this.pendingGame || this.pendingGame.ticket !== ticket || this.pendingGame.target !== target) return null
    const lease = this.pendingGame.lease
    this.pendingGame = null
    return lease.transfer()
  }

  discardPendingGame(ticket?: number) {
    if (!this.pendingGame || (ticket !== undefined && this.pendingGame.ticket !== ticket)) return
    const pending = this.pendingGame; this.pendingGame = null
    pending.lease.release()
  }
}

export const appearanceRuntime = new AppearanceRuntime()

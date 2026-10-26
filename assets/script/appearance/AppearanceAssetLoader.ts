// 按本地资源标识合并加载；租约拥有显式引用，取消时立即结束等待并屏蔽晚到回调。
import { Asset, assetManager, Prefab, resources, SpriteFrame } from 'cc'
import { appearanceAssetKey, type AppearanceAssetRef } from './AppearanceTypes'

type Result = { status: 'ready'; asset: Asset } | { status: 'failed'; error: Error } | { status: 'cancelled' }
type Loaded = (error: Error | null, asset: Asset | null) => void
export type AppearanceAssetBackend = { load(ref: AppearanceAssetRef, done: Loaded): void }
type Entry = { key: string; asset: Asset | null; waiting: boolean; leases: Set<AppearanceAssetLease> }

export class AppearanceAssetLease {
  private released = false
  private settled = false
  private resolve!: (result: Result) => void
  readonly ready = new Promise<Result>(resolve => { this.resolve = resolve })

  constructor(private readonly entry: Entry, private readonly releaseEntry: (lease: AppearanceAssetLease) => void, private callback?: Loaded) {}

  get asset() { return this.released ? null : this.entry.asset }
  get isReleased() { return this.released }

  finish(error: Error | null, asset: Asset | null) {
    if (this.settled || this.released) return
    this.settled = true
    const callback = this.callback; this.callback = undefined
    this.resolve(error || !asset ? { status: 'failed', error: error ?? new Error('外观资源为空') } : { status: 'ready', asset })
    callback?.(error, asset)
  }

  release() {
    if (this.released) return
    this.released = true
    this.callback = undefined
    if (!this.settled) { this.settled = true; this.resolve({ status: 'cancelled' }) }
    this.releaseEntry(this)
  }
}

const bundleLoads = new Map<string, Array<(error: Error | null, bundle?: any) => void>>()
const cocosBackend: AppearanceAssetBackend = {
  load(ref, done) {
    const type = ref.kind === 'spriteFrame' ? SpriteFrame : Prefab
    const finish: Loaded = (error, asset) => done(error || (asset && !(asset instanceof type) ? new Error('外观资源类型不匹配') : null), asset)
    if (ref.source === 'binding') { done(new Error('序列化外观引用由宿主提供'), null); return }
    if (ref.source === 'uuid') { assetManager.loadAny(ref.uuid, finish); return }
    if (ref.source === 'resources') { resources.load(ref.path, type as typeof SpriteFrame, finish); return }
    const load = (error: Error | null, bundle?: any) => {
      if (error || !bundle) { done(error ?? new Error('外观 Bundle 为空'), null); return }
      try { bundle.load(ref.path, type, finish) } catch (failure) { done(failure instanceof Error ? failure : new Error(String(failure)), null) }
    }
    const existing = assetManager.getBundle(ref.bundle)
    if (existing) { load(null, existing); return }
    const pending = bundleLoads.get(ref.bundle)
    if (pending) { pending.push(load); return }
    bundleLoads.set(ref.bundle, [load])
    const complete = (error: Error | null, bundle?: any) => {
      const callbacks = bundleLoads.get(ref.bundle) ?? []
      bundleLoads.delete(ref.bundle)
      for (const callback of callbacks) callback(error, bundle)
    }
    try { assetManager.loadBundle(ref.bundle, complete) } catch (failure) { complete(failure instanceof Error ? failure : new Error(String(failure))) }
  }
}

export class AppearanceAssetLoader {
  private readonly entries = new Map<string, Entry>()
  constructor(private readonly backend: AppearanceAssetBackend = cocosBackend) {}

  acquire(ref: AppearanceAssetRef, callback?: Loaded): AppearanceAssetLease {
    const key = appearanceAssetKey(ref)
    let entry = this.entries.get(key)
    const fresh = !entry
    if (!entry) { entry = { key, asset: null, waiting: true, leases: new Set() }; this.entries.set(key, entry) }
    const current = entry
    const lease = new AppearanceAssetLease(current, owner => {
      current.leases.delete(owner)
      if (!current.leases.size && !current.waiting) this.releaseEntry(current)
    }, callback)
    current.leases.add(lease)
    if (fresh) {
      const done: Loaded = (error, asset) => {
        if (!current.waiting) return
        current.waiting = false
        // 即使全部调用者已取消，迟到资产也在资产层成对接管和释放。
        if (asset) { current.asset = asset; asset.addRef() }
        if (error || !asset) {
          if (this.entries.get(key) === current) this.entries.delete(key)
          // Creator 的 loose 展开不会迭代 Set；显式快照也避免释放时改变遍历集合。
          const failed = Array.from(current.leases)
          for (const owner of failed) owner.finish(error ?? new Error('外观资源为空'), null)
          for (const owner of failed) owner.release()
        } else {
          for (const owner of Array.from(current.leases)) owner.finish(null, asset)
        }
        if (!current.leases.size) this.releaseEntry(current)
      }
      try { this.backend.load(ref, done) } catch (error) { done(error instanceof Error ? error : new Error(String(error)), null) }
    } else if (!current.waiting) lease.finish(null, current.asset)
    return lease
  }

  private releaseEntry(entry: Entry) {
    if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key)
    const asset = entry.asset; entry.asset = null
    if (asset?.isValid) asset.decRef()
  }
}

export const appearanceAssetLoader = new AppearanceAssetLoader()

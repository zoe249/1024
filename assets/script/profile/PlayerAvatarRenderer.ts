import { assetManager, ImageAsset, Mask, Node, Rect, resources, Size, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc'
import { getAvatarSpritePath, normalizePlayerAvatar, type PlayerAvatar } from './AvatarCatalog'

type RemoteAvatar = { frame: SpriteFrame; texture: Texture2D; image: ImageAsset; users: number }
const remoteCache = new Map<string, RemoteAvatar>()
const pending = new Map<string, Promise<RemoteAvatar>>()
const CACHE_LIMIT = 24

function pruneCache() {
  for (const [url, entry] of remoteCache) {
    if (remoteCache.size <= CACHE_LIMIT) break
    if (entry.users > 0) continue
    remoteCache.delete(url)
    entry.frame.destroy()
    entry.texture.destroy()
    entry.image.decRef()
  }
}

type WechatNativeImage = {
  src: string
  width: number
  height: number
  premultiplyAlpha?: boolean
  onload: (() => void) | null
  onerror: (() => void) | null
}

/** 小游戏原生 Image 直接读取 URL；不能经引擎下载器转成临时文件，否则会触发下载域名校验。 */
function loadAvatarImage(url: string): Promise<ImageAsset> {
  const wxApi = (globalThis as { wx?: { createImage?: () => WechatNativeImage } }).wx
  if (typeof wxApi?.createImage === 'function') {
    return new Promise((resolve, reject) => {
      let nativeImage: WechatNativeImage | null = null
      let finished = false
      const timeout = setTimeout(() => fail(), 15_000)
      const clean = () => {
        clearTimeout(timeout)
        if (nativeImage) { nativeImage.onload = null; nativeImage.onerror = null }
      }
      const fail = () => {
        if (finished) return
        finished = true
        clean()
        if (nativeImage) {
          try { nativeImage.src = '' } catch { /* 部分平台不接受空地址，回调已解绑。 */ }
        }
        reject(new Error('头像加载失败，请重试'))
      }
      try {
        nativeImage = wxApi.createImage!()
        nativeImage.premultiplyAlpha = false
        nativeImage.onload = () => {
          if (finished || !nativeImage) return
          if (nativeImage.width <= 0 || nativeImage.height <= 0) { fail(); return }
          try {
            // 微信适配层的 HTMLImageElement 就是原生 Image 构造器，类型转换不复制像素。
            const image = new ImageAsset(nativeImage as unknown as HTMLImageElement)
            finished = true
            clean()
            resolve(image)
          } catch { fail() }
        }
        nativeImage.onerror = fail
        nativeImage.src = url
      } catch { fail() }
    })
  }
  // Web 预览继续使用引擎图片加载能力，仍受浏览器 CORS 约束。
  return new Promise((resolve, reject) => {
    assetManager.loadRemote<ImageAsset>(url, { ext: '.png', cacheAsset: false }, (error, image) => {
      if (error || !image) reject(new Error('头像加载失败，请重试'))
      else resolve(image)
    })
  })
}

function loadRemoteAvatar(url: string): Promise<RemoteAvatar> {
  const cached = remoteCache.get(url)
  if (cached) {
    remoteCache.delete(url)
    remoteCache.set(url, cached)
    return Promise.resolve(cached)
  }
  const underway = pending.get(url)
  if (underway) return underway
  const request = loadAvatarImage(url).then(image => {
    image.addRef()
    let texture: Texture2D | null = null
    let frame: SpriteFrame | null = null
    try {
      texture = new Texture2D()
      texture.image = image
      frame = new SpriteFrame()
      frame.texture = texture
      // 中央正方形裁剪保持照片比例；圆形边缘由 Mask 处理。
      const size = Math.min(image.width, image.height)
      frame.rect = new Rect((image.width - size) / 2, (image.height - size) / 2, size, size)
      frame.originalSize = new Size(size, size)
      const entry = { frame, texture, image, users: 0 }
      remoteCache.set(url, entry)
      return entry
    } catch (error) {
      frame?.destroy()
      texture?.destroy()
      image.decRef()
      throw error
    }
  }).then(entry => { pending.delete(url); return entry }, error => { pending.delete(url); throw error })
  pending.set(url, request)
  return request
}

/** 每个显示位置独立持有引用和代次，避免旧请求覆盖新头像或释放其他位置使用的纹理。 */
export class PlayerAvatarRenderer {
  private revision = 0
  private remote: RemoteAvatar | null = null
  private clip: Mask | null = null
  private disposed = false

  constructor(private readonly sprite: Sprite) {}

  async render(avatar: PlayerAvatar): Promise<boolean> {
    const revision = ++this.revision
    this.release()
    if (this.disposed || !this.sprite.isValid) return false
    this.sprite.spriteFrame = null
    if (this.clip?.isValid) this.clip.enabled = false
    const normalized = normalizePlayerAvatar(avatar)
    const isCurrent = () => !this.disposed && this.sprite.isValid && revision === this.revision
    const local = new Promise<void>(resolve => {
      resources.load(getAvatarSpritePath(normalized.avatarIndex), SpriteFrame, (error, frame) => {
        if (isCurrent() && !this.remote && !error) this.sprite.spriteFrame = frame
        resolve()
      })
    })
    if (normalized.avatarType !== 'wechat' || !normalized.wechatAvatarUrl) {
      await local
      return normalized.avatarType !== 'wechat'
    }
    try {
      const entry = await loadRemoteAvatar(normalized.wechatAvatarUrl).then(value => {
        value.users += 1
        return value
      })
      if (!isCurrent()) { entry.users -= 1; pruneCache(); return false }
      this.remote = entry
      this.ensureClip()
      this.sprite.spriteFrame = entry.frame
      pruneCache()
      return true
    } catch {
      await local
      return false
    }
  }

  /** 隐藏界面时取消在途回调并释放引用；重新显示时由控制器重新渲染。 */
  clear() {
    this.revision += 1
    if (this.sprite.isValid) this.sprite.spriteFrame = null
    this.release()
  }

  dispose() {
    this.clear()
    this.disposed = true
  }

  private release() {
    if (this.remote) this.remote.users -= 1
    this.remote = null
    pruneCache()
  }

  private ensureClip() {
    if (!this.clip) {
      const spriteNode = this.sprite.node
      const transform = spriteNode.getComponent(UITransform)!
      const clipNode = new Node('WechatAvatarClip')
      clipNode.layer = spriteNode.layer
      clipNode.setParent(spriteNode.parent)
      clipNode.setPosition(spriteNode.position)
      clipNode.setSiblingIndex(spriteNode.getSiblingIndex())
      clipNode.addComponent(UITransform).setContentSize(transform.contentSize)
      this.clip = clipNode.addComponent(Mask)
      this.clip.type = Mask.Type.GRAPHICS_ELLIPSE
      spriteNode.setParent(clipNode)
      spriteNode.setPosition(0, 0, 0)
    }
    this.clip.enabled = true
  }
}

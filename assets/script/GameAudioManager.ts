import { AudioClip, AudioSource, Node } from 'cc'

// 集中管理游戏音频节点，避免 PlayController 同时承担玩法和音频生命周期。
export class GameAudioManager {
  private bgmAudioSource: AudioSource | null = null
  private sfxAudioSource: AudioSource | null = null

  constructor(private readonly ownerNode: Node) {}

  // 运行时自动准备一对音频源，避免场景里必须手动摆放 BGM 和 SFX 节点。
  setup() {
    this.bgmAudioSource = this.ensureAudioSourceNode('GameBgmAudioSource')
    this.sfxAudioSource = this.ensureAudioSourceNode('GameSfxAudioSource')
  }

  // 首页音乐使用独立入口，当前没有绑定资源时不会播放任何背景音乐。
  playStartPageBackgroundMusic(clip: AudioClip | null) {
    this.playLoopBackgroundMusic(clip)
  }

  // 玩法音乐只在点击开始进入对局后播放，避免首页误播游戏内 BGM。
  playGameplayBackgroundMusic(clip: AudioClip | null) {
    this.playLoopBackgroundMusic(clip)
  }

  // 所有短音效都走 one-shot，避免切断当前正在播放的其他反馈音。
  playSoundEffect(clip: AudioClip | null) {
    if (!clip || !this.sfxAudioSource) {
      return
    }

    this.sfxAudioSource.playOneShot(clip)
  }

  // 音频节点不存在时自动创建；已存在则直接复用，避免反复加组件。
  private ensureAudioSourceNode(nodeName: string) {
    let audioNode = this.ownerNode.getChildByName(nodeName)
    if (!audioNode) {
      audioNode = new Node(nodeName)
      audioNode.setParent(this.ownerNode)
      audioNode.setPosition(0, 0, 0)
    }

    return audioNode.getComponent(AudioSource) ?? audioNode.addComponent(AudioSource)
  }

  /**
   * 播放或停止循环背景音乐。
   *
   * clip 为空时会停止当前 BGM，避免返回首页后继续播放玩法音乐；
   * clip 变化时先停止旧音频再切换，clip 相同时不会重复调用 play。
   *
   * @param clip 要循环播放的背景音乐；为空时表示停止背景音乐。
   */
  private playLoopBackgroundMusic(clip: AudioClip | null) {
    if (!this.bgmAudioSource) {
      return
    }

    if (!clip) {
      // 首页未配置专属 BGM 时，需要停止玩法 BGM，避免返回首页后继续播放游戏音乐。
      if (this.bgmAudioSource.playing) {
        this.bgmAudioSource.stop()
      }
      this.bgmAudioSource.clip = null
      return
    }

    if (this.bgmAudioSource.playing && this.bgmAudioSource.clip !== clip) {
      this.bgmAudioSource.stop()
    }

    this.bgmAudioSource.clip = clip
    this.bgmAudioSource.loop = true
    if (this.bgmAudioSource.playing) {
      return
    }

    this.bgmAudioSource.play()
  }
}

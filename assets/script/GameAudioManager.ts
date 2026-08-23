import { assetManager, AudioClip, AudioSource, Node } from 'cc'

const DEFAULT_BUTTON_CLICK_AUDIO_UUID = 'b0c7278f-5a0b-4b77-acd9-1f92b427a817'

// 集中管理游戏音频节点，避免 PlayController 同时承担玩法和音频生命周期。
export class GameAudioManager {
  private bgmAudioSource: AudioSource | null = null
  private sfxAudioSource: AudioSource | null = null
  private defaultButtonClickClip: AudioClip | null = null
  private isLoadingButtonClickClip = false

  constructor(private readonly ownerNode: Node) {}

  // 运行时自动准备一对音频源，避免场景里必须手动摆放 BGM 和 SFX 节点。
  setup() {
    this.bgmAudioSource = this.ensureAudioSourceNode('GameBgmAudioSource')
    this.sfxAudioSource = this.ensureAudioSourceNode('GameSfxAudioSource')
    this.preloadDefaultButtonClickClip()
  }

  // 首页音乐使用独立入口，当前没有绑定资源时不会播放任何背景音乐。
  playStartPageBackgroundMusic(clip: AudioClip | null) {
    this.playLoopBackgroundMusic(clip)
  }

  // 玩法音乐只在进入对局或重新开始后播放，避免首页误播游戏内 BGM。
  playGameplayBackgroundMusic(clip: AudioClip | null) {
    this.playLoopBackgroundMusic(clip)
  }

  // 游戏结束时暂停背景音乐，保留短音效通道继续播放结算反馈。
  pauseBackgroundMusic() {
    if (this.bgmAudioSource?.playing) {
      this.bgmAudioSource.pause()
    }
  }

  // 所有短音效都走 one-shot，避免切断当前正在播放的其他反馈音。
  playSoundEffect(clip: AudioClip | null) {
    if (!clip || !this.sfxAudioSource) {
      return
    }

    this.sfxAudioSource.playOneShot(clip)
  }

  // 按钮点击反馈统一从这里播放；场景未显式绑定时兜底使用内置 click.bubble 音效。
  playButtonClickEffect(clip: AudioClip | null) {
    const targetClip = clip ?? this.defaultButtonClickClip
    if (targetClip) {
      this.playSoundEffect(targetClip)
      return
    }

    this.preloadDefaultButtonClickClip()
  }

  // 音频节点不存在时自动创建；已存在则直接复用，避免重复加组件。
  private ensureAudioSourceNode(nodeName: string) {
    let audioNode = this.ownerNode.getChildByName(nodeName)
    if (!audioNode) {
      audioNode = new Node(nodeName)
      audioNode.setParent(this.ownerNode)
      audioNode.setPosition(0, 0, 0)
    }

    return audioNode.getComponent(AudioSource) ?? audioNode.addComponent(AudioSource)
  }

  private preloadDefaultButtonClickClip() {
    if (this.defaultButtonClickClip || this.isLoadingButtonClickClip) {
      return
    }

    this.isLoadingButtonClickClip = true
    assetManager.loadAny(DEFAULT_BUTTON_CLICK_AUDIO_UUID, (error, asset) => {
      this.isLoadingButtonClickClip = false
      if (error || !(asset instanceof AudioClip)) {
        return
      }

      this.defaultButtonClickClip = asset
    })
  }

  /**
   * 播放或停止循环背景音乐。
   *
   * clip 为空时会停止当前 BGM，避免返回首页后继续播放玩法音乐；
   * clip 变化时先停止旧音频再切换，clip 相同时不会重复重启正在播放的音乐。
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

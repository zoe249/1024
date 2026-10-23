// 技能栏只应用纯状态与表现动画，操作意图仍由 PlayUIController 回调给玩法层。
import { Color, Graphics, Label, Node, Sprite, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc'
import type { SkillKind as PlaySkillKind } from '../economy/SkillStock'

type SkillBarState = {
  readonly activeSkill: PlaySkillKind | null
  readonly skillUsed: Readonly<Record<PlaySkillKind, boolean>>
  readonly skillCounts: Readonly<Record<PlaySkillKind, number>>
  readonly skillAdAvailable: Readonly<Record<PlaySkillKind, boolean>>
  readonly skillAdLoading: PlaySkillKind | null
}

const SKILL_DISABLED_OPACITY = 118
const SKILL_EMPTY_OPACITY = 178

export class SkillBarView {
  static renderSelection(skill: PlaySkillKind, skillNode: Node | null, state: SkillBarState, previousKey: string) {
    if (!skillNode) {
      return previousKey
    }

    const isActive = state.activeSkill === skill
    const isUsed = state.skillUsed[skill]
    const count = Math.max(0, state.skillCounts[skill])
    const canWatchAd = state.skillAdAvailable[skill]
    const isAdBusy = state.skillAdLoading !== null
    const visualKey = `${isActive}-${isUsed}-${count}-${canWatchAd}-${isAdBusy}`
    skillNode.getChildByName('SelectionRing')!.active = isActive && count > 0 && !isAdBusy
    // 技能状态只通过图标明暗和次数角标表达，避免文字遮挡图标。
    skillNode.getChildByName('UsedLabel')!.active = false
    const opacity = skillNode.getComponent(UIOpacity) ?? skillNode.addComponent(UIOpacity)
    opacity.opacity = isAdBusy ? SKILL_EMPTY_OPACITY : count > 0 || canWatchAd ? 255 : isUsed ? SKILL_DISABLED_OPACITY : SKILL_EMPTY_OPACITY

    if (previousKey === visualKey) {
      return previousKey
    }
    Tween.stopAllByTarget(skillNode)
    tween(skillNode)
      .to(0.1, { scale: isActive ? new Vec3(1.05, 1.05, 1) : Vec3.ONE }, { easing: 'quadOut' })
      .start()
    return visualKey
  }

  static renderCount(skill: PlaySkillKind, skillNode: Node | null, state: SkillBarState, counterNumberSpriteFrames: SpriteFrame[]) {
    if (!skillNode) {
      return
    }

    const boxNode = this.getSkillBox(skillNode)
    const moreButtonNode = boxNode.getChildByName('MoreBtn')
    const amountBgNode = boxNode.getChildByName('AmountBG')
    const countNode = boxNode.getChildByName('Count')

    const count = state.skillCounts[skill] > 0 ? 1 : 0
    const isLoading = state.skillAdLoading === skill
    const showsAd = count === 0 && state.skillAdAvailable[skill] && !isLoading
    const customBadge = skillNode.getChildByName('CountBadge')
    const customBadgeLabel = customBadge?.getChildByName('Value')?.getComponent(Label) ?? null
    if (customBadge) {
      customBadge.active = true
      // 场景使用 Sprite 底图，旧场景补建 Graphics 底图；广告态需要同时兼容。
      const background = customBadge.getComponent(Graphics) ?? customBadge.getComponent(Sprite)
      if (background) {
        background.enabled = !showsAd
      }
      const adNode = customBadge.getChildByName('AdIcon')
      if (adNode) {
        adNode.active = showsAd
      }
      const loadingNode = customBadge.getChildByName('AdLoading')
      if (loadingNode && loadingNode.active !== isLoading) {
        Tween.stopAllByTarget(loadingNode)
        loadingNode.angle = 0
        loadingNode.active = isLoading
        if (isLoading) {
          tween(loadingNode).by(0.8, { angle: -360 }).repeatForever().start()
        }
      }
    }
    if (customBadgeLabel) {
      const showsCount = !showsAd && !isLoading
      customBadgeLabel.string = showsCount ? `${count}` : ''
      customBadgeLabel.node.active = showsCount
    }
    if (moreButtonNode) {
      // 对局技能只展示次数或视频角标，不保留旧补货入口。
      moreButtonNode.active = false
    }
    if (amountBgNode) {
      amountBgNode.active = false
    }
    if (countNode) {
      countNode.active = false
      const countSprite = countNode.getComponent(Sprite) ?? countNode.addComponent(Sprite)
      const spriteFrame = this.getCounterNumberSpriteFrame(count, counterNumberSpriteFrames)
      countSprite.spriteFrame = spriteFrame
      countSprite.enabled = !!spriteFrame
      countSprite.sizeMode = Sprite.SizeMode.CUSTOM
      const fallback = this.ensureSkillCountFallback(countNode)
      fallback.node.active = !spriteFrame
      fallback.string = `${count}`
    }
  }

  private static ensureSkillCountFallback(countNode: Node) {
    let fallbackNode = countNode.getChildByName('FallbackLabel')
    if (!fallbackNode) {
      fallbackNode = new Node('FallbackLabel')
      fallbackNode.setParent(countNode)
      fallbackNode.addComponent(UITransform).setContentSize(28, 24)
      fallbackNode.addComponent(Label)
    }
    fallbackNode.setPosition(0, 0, 0)
    const label = fallbackNode.getComponent(Label) ?? fallbackNode.addComponent(Label)
    label.fontSize = 17
    label.lineHeight = 20
    label.color = new Color(255, 255, 255, 255)
    label.horizontalAlign = Label.HorizontalAlign.CENTER
    label.verticalAlign = Label.VerticalAlign.CENTER
    label.isBold = true
    return label
  }

  // counterNumberSpriteFrames 里的图片以 0-9 命名，优先按名字找，找不到时用下标兜底。
  private static getCounterNumberSpriteFrame(count: number, counterNumberSpriteFrames: SpriteFrame[]) {
    const displayCount = Math.min(9, Math.max(0, count))
    const displayName = `${displayCount}`
    return (
      counterNumberSpriteFrames.find((spriteFrame) => spriteFrame?.name === displayName) ??
      counterNumberSpriteFrames[displayCount] ??
      null
    )
  }

  static getSkillBox(skillNode: Node) {
    return skillNode.getChildByName('Box') ?? skillNode
  }

  // 新版场景直接使用 CountBadge；这里只读取历史 Count 图片，不再为新版层级动态补旧节点。
}

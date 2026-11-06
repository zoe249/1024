// 验证实际玩法入口、阶段恢复和预制件动画；节点模拟不替代 Creator／微信验收。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { environment } = require('./verify-refactor.cjs')
const root = path.resolve(__dirname, '..')
const plain = value => JSON.parse(JSON.stringify(value))

async function verify(loose) {
  let transform = value => value
  if (loose) {
    const tsRoot = path.dirname(require.resolve((process.argv[2] || 'typescript') + '/package.json'))
    const modules = path.resolve(tsRoot, '../../../resources/3d/engine/node_modules')
    const babel = require(path.join(modules, '@babel/core'))
    const spread = require(path.join(modules, '@babel/plugin-transform-spread'))
    transform = value => babel.transformSync(value, { babelrc:false, configFile:false, plugins:[[spread,{loose:true}]] }).code
  }
  const env = environment(false, transform), { cc, load, child } = env
  cc.Node.EventType = { TOUCH_END:'touch-end', TOUCH_START:'touch-start' }
  cc.Node.prototype.on = function(name, handler) { (this.events ??= {})[name] = handler }
  cc.Node.prototype.off = function(name) { if(this.events)delete this.events[name] }
  const animationTrace = [], delayed = [], shuffleFrames = []
  let deferZoom = false, deferShuffle = false, sampleShuffle = () => {}
  cc.tween = target => {
    const operations = [], chain = {}
    chain.to = (duration, properties, options={}) => { operations.push({duration,properties,options});return chain }
    chain.call = callback => { operations.push({callback});return chain }
    chain.start = () => {
      const run = () => operations.forEach(op => {
        if(op.callback) {op.callback();return}
        animationTrace.push({duration:op.duration,easing:op.options.easing})
        if(target && Object.hasOwn(op.properties,'progress')) {
          for(const progress of [0,.25,.5,.75,1]) {target.progress=progress;op.options.onUpdate?.(target,progress)}
        } else if(target && Object.hasOwn(op.properties,'time')) {
          for(let time=0;time<op.duration;time+=.025) {target.time=time;op.options.onUpdate?.(target,time/op.duration);sampleShuffle(time)}
          target.time=op.duration;op.options.onUpdate?.(target,1);sampleShuffle(op.duration)
        } else { Object.assign(target,op.properties);op.options.onUpdate?.(target,1) }
      })
      if(deferZoom && Object.hasOwn(target,'progress')) delayed.push(run)
      else if(deferShuffle && Object.hasOwn(target,'time')) delayed.push(run)
      else run()
      return chain
    }
    return chain
  }
  const progression = load('assets/script/gameplay/EndlessProgression.ts')
  const { BoardModel } = load('assets/script/gameplay/BoardModel.ts')
  const { BoardGeometry } = load('assets/script/gameplay/BoardGeometry.ts')
  const { ScoreManager } = load('assets/script/gameplay/ScoreManager.ts')
  const { PieceController } = load('assets/script/gameplay/PieceController.ts')
  const { PlayEffects } = load('assets/script/gameplay/PlayEffects.ts')
  const { TransientFxRegistry } = load('assets/script/gameplay/TransientFxRegistry.ts')
  const { PlayController } = load('assets/script/gameplay/PlayController.ts')
  const { OngoingGameSession: session } = load('assets/script/gameplay/OngoingGameSession.ts')
  function piece(value) {
    const node=new cc.Node('Piece');node.addComponent(cc.UITransform)
    for(const name of ['Shadow','Body','Outline','Highlight','Decoration'])child(node,name).addComponent(cc.Sprite)
    child(node,'Value').addComponent(cc.Label)
    const controller=node.addComponent(PieceController);controller.onLoad();controller.setValue(value)
    return controller
  }
  cc.instantiate=()=>piece(2).node
  function harness(snapshot) {
    const config=snapshot?.boardConfig ?? {columns:5,rows:7}
    session.beginNewGame(config)
    const c=Object.create(PlayController.prototype),node=new cc.Node('Main')
    node.addComponent(cc.UITransform).setContentSize(750,1334)
    const boardNode=child(node,'board');boardNode.setPosition(0,-60,0)
    child(boardNode,'BoardFill').getComponent(cc.UITransform).setContentSize(config.columns*130,config.rows*130)
    const pieceLayer=child(node,'PieceLayer'), fxLayer=child(node,'FxLayer')
    const boardModel=new BoardModel(),scoreManager=new ScoreManager(),frames=[]
    Object.assign(c,{node,isValid:true,enabledInHierarchy:true,boardwidth:config.columns,boardheight:config.rows,
      pieceSize:120,spacing:10,spawnOffsetY:260,originalPieceSize:120,originalSpacing:10,originalSpawnOffset:260,
      fallSpeed:360,fastFallSpeed:1800,boardModel,scoreManager,pieceLayer,fxLayer,board:boardModel.createEmptyBoard(config.rows,config.columns),
      stageTargetValue:1024,wildcardInterval:6,progression:progression.createProgression(config),stageRevision:0,stageDisposed:false,
      zoomState:null,zoomDone:null,zoomCurrentHeight:null,stageCheckpoint:null,currentPiece:null,currentColumn:2,
      currentPieceKind:'normal',nextKind:'normal',nextPieceValue:2,basePieceController:{},gameAppearance:null,
      firstEntryTutorialStep:0,isTutorialAwaitingTap:false,isFastDropping:false,hasStartedSession:true,isGameOver:false,isPaused:false,isResolving:false,
      usedSkillsThisGame:{bomb:false,hammer:false,swap:false},skillAdRewards:{bomb:'unclaimed',hammer:'unclaimed',swap:'unclaimed'},skillAdLoading:null,
      isBombSkillActive:false,isHammerSkillActive:false,isSwapSkillActive:false,
      clearTransientEffects(){},playSoundEffect(){},advanceFirstEntryTutorialAfterLanding(){},randomBasePieceValue:()=>2,
      refreshUiState(){},playEffects:new PlayEffects(new TransientFxRegistry(18),120,()=>fxLayer),
      uiController:{isValid:true,updateBoardLayout(layout){frames.push(layout.pieceSize)},closeStageChoice:()=>Promise.resolve(true)},
      animateMove:async(node,position)=>node.setPosition(position),
      animateDirectedMerge:async(anchor,position,consumed,value)=>{anchor.setValue(value);scoreManager.updateHighestPieceValue(value);anchor.node.setPosition(position);consumed.forEach(piece=>piece.node.destroy())}
    })
    c.boardGeometry=new BoardGeometry(node,c.buildBoardGeometryOptions())
    if(snapshot) {
      c.progression=progression.cloneProgression(snapshot.progression)
      c.applyStageLayout(1)
      c.restoreOngoingGame(snapshot)
    }
    const put=(r,col,value)=>{const p=piece(value);p.node.setParent(pieceLayer);p.node.setPosition(c.getCellPosition(r,col));c.board[r][col]=p;return p}
    return {c,put,frames}
  }
  const boardValues=c=>plain(c.board.map(row=>row.map(p=>p?.getValue()??null)))
  const history = progression.createProgression({columns:5,rows:7})
  history.highestMergeValue=2048
  assert.equal(progression.shouldPromote(history),true)
  const invalid=progression.cloneProgression(history);invalid.phase=2
  assert.equal(progression.isValidProgression(invalid,{columns:5,rows:7}),false)
  assert.equal(progression.isValidProgression(progression.createProgression({columns:6,rows:7}),{columns:6,rows:7}),true)

  const landing=harness();landing.put(0,1,512);landing.put(0,3,512)
  landing.c.currentPiece=piece(512);landing.c.currentPiece.node.setParent(landing.c.pieceLayer)
  await landing.c.landPiece(0,2)
  assert.equal(landing.c.progression.phase,2,'三颗512直接跨过1024也要晋级')
  assert.equal(landing.c.boardwidth,7);assert.equal(landing.c.boardheight,8)
  assert.equal(landing.c.board[0][3].getValue(),2048)
  assert.equal(landing.c.currentPiece,null,'弹窗确认前不能生成下一颗')
  assert.equal(landing.c.nextPieceValue,2)
  assert.equal(landing.c.isWaitingForStageChoice(),true)
  assert(landing.frames.some(v=>v<120&&v>120*5/7),'拉远必须有中间帧')
  assert(animationTrace.some(x=>x.duration===.8&&x.easing==='sineInOut'))
  const promotionSnapshot=session.consumeSnapshot()
  assert.equal(promotionSnapshot.boardValues.length,8)
  assert.equal(promotionSnapshot.progression.choice,null)
  const resumed=harness(promotionSnapshot)
  await resumed.c.resumeStageOrSpawn();assert.equal(resumed.c.currentPiece,null)
  await resumed.c.chooseStageEffect('shuffle');assert.equal(resumed.c.progression.choice,null,'无有效排列时不消耗选择')

  const diagonal=harness();diagonal.put(0,0,32);diagonal.put(0,1,2);diagonal.put(1,1,32)
  assert.equal(diagonal.c.findMergeGroups(null).length,0)
  diagonal.c.progression.highestMergeValue=1024
  await diagonal.c.promoteIfReady();await diagonal.c.chooseStageEffect('diagonal')
  assert.equal(diagonal.c.progression.choiceApplied,true)
  assert.equal(diagonal.c.board[0][1].getValue(),64)
  const diagonalSnapshot=diagonal.c.buildOngoingGameSnapshot(), diagonalRestored=harness(diagonalSnapshot)
  assert.equal(diagonalRestored.c.progression.choice,'diagonal')
  await diagonal.c.chooseStageEffect('wildcard');assert.equal(diagonal.c.progression.choice,'diagonal')

  const wildcard=harness();wildcard.put(0,2,256);wildcard.c.progression.highestMergeValue=1024
  await wildcard.c.promoteIfReady();await wildcard.c.chooseStageEffect('wildcard')
  for(let ordinal=1;ordinal<=6;ordinal++) {
    assert.equal(wildcard.c.progression.spawnedSinceChoice,ordinal)
    assert.equal(wildcard.c.currentPieceKind,ordinal===6?'wildcard':'normal')
    if(ordinal===5)assert.equal(wildcard.c.nextKind,'wildcard','第五颗时预览第六颗万能')
    if(ordinal<6){wildcard.c.currentPiece.node.destroy();wildcard.c.currentPiece=null;wildcard.c.spawnPiece()}
  }
  const wildcardSnapshot=wildcard.c.buildOngoingGameSnapshot(),wildcardRestored=harness(wildcardSnapshot)
  assert.equal(wildcardRestored.c.currentPieceKind,'wildcard');assert.equal(wildcardRestored.c.progression.spawnedSinceChoice,6)
  await wildcardRestored.c.landPiece(1,3)
  assert.equal(wildcardRestored.c.board[0][3].getValue(),512)
  assert.equal(wildcardRestored.c.progression.spawnedSinceChoice,7)
  wildcard.c.board=wildcard.c.boardModel.createEmptyBoard(8,7)
  await wildcard.c.landPiece(0,6);assert.equal(wildcard.c.board[0][6].getValue(),2,'空列万能变为2')

  const shuffle=harness();shuffle.put(0,0,32);shuffle.put(0,1,64);shuffle.put(0,3,32)
  shuffle.c.progression.highestMergeValue=1024;await shuffle.c.promoteIfReady()
  const cues=[],originalRedeal=shuffle.c.playEffects.playShuffleRedeal.bind(shuffle.c.playEffects)
  let shuffleAudio=0
  shuffle.c.playSoundEffect=()=>shuffleAudio++
  shuffle.c.playEffects.playShuffleRedeal=(targets,gather,alive,feedback)=>originalRedeal(targets,gather,alive,cue=>{cues.push(cue);feedback?.(cue)})
  const before=boardValues(shuffle.c),beforeValues=before.flat().filter(v=>v!==null).sort((a,b)=>a-b)
  let close;shuffle.c.uiController.closeStageChoice=()=>new Promise(resolve=>{close=resolve})
  const choosing=shuffle.c.chooseStageEffect('shuffle')
  const fixed=plain(shuffle.c.buildOngoingGameSnapshot())
  assert.deepEqual(fixed.boardValues.flat().filter(v=>v!==null).sort((a,b)=>a-b),beforeValues)
  assert.notDeepEqual(fixed.boardValues,before)
  assert(fixed.boardValues[0].filter(v=>v!==null).length>=2,'回落不能全部挤到同一列')
  sampleShuffle=time=>shuffleFrames.push({time,pieces:shuffle.c.board.flat().filter(Boolean).map(piece=>({
    position:plain(piece.node.position),scale:plain(piece.node.scale),alpha:piece.node.getComponent(cc.UIOpacity)?.opacity,
    targetX:shuffle.c.getCellPosition(0,shuffle.c.findPiece(piece).column).x,angle:piece.node.angle,sibling:piece.node.getSiblingIndex(),body:plain(piece.node.getChildByName('Body').getComponent(cc.Sprite).color)
  })),lines:shuffle.c.fxLayer.children.find(node=>node.name==='ShuffleSpeedLines'&&node.isValid)?.getComponent(cc.Graphics)?.ops.filter(op=>op[0]==='lineTo').length??0,impacts:shuffle.c.fxLayer.children.find(node=>node.name==='ShuffleSpeedLines'&&node.isValid)?.getComponent(cc.Graphics)?.ops.filter(op=>op[0]==='ellipse').length??0})
  close(true);await choosing
  sampleShuffle=()=>{}
  const gatherEnd=.09+.42+.008,shuffleEnd=gatherEnd+.78,dealStart=shuffleEnd+.10
  const movingRecall=shuffleFrames.filter(frame=>frame.time>.10&&frame.time<gatherEnd)
  const recallOrigins=shuffleFrames[0].pieces
  const recallPoint=shuffle.c.getCellPosition(7,3).add3f(0,shuffle.c.getStepSize(),0)
  assert(movingRecall.every(frame=>frame.pieces.every(piece=>piece.alpha===255&&piece.scale.x>=.92)),'收牌位移期间必须保持清晰可见，不能提前淡出或缩成小点')
  assert(movingRecall.some(frame=>frame.time>.25&&frame.time<.4&&frame.pieces.some((piece,i)=>piece.position.y-recallOrigins[i].position.y>150)),'回收中途必须能看见方块明显向上移动')
  const washing=shuffleFrames.filter(frame=>frame.time>=gatherEnd&&frame.time<shuffleEnd)
  assert(washing.some(frame=>Math.max(...frame.pieces.map(piece=>piece.position.x))-Math.min(...frame.pieces.map(piece=>piece.position.x))>shuffle.c.pieceSize*1.5),'洗牌必须分成两叠拉开')
  assert(washing.some(frame=>frame.pieces[0].position.x>recallPoint.x+shuffle.c.pieceSize*.5)&&washing.some(frame=>frame.pieces[0].position.x<recallPoint.x-shuffle.c.pieceSize*.5),'牌叠必须交叉换边，不能只在一边摇晃')
  assert(new Set(washing.map(frame=>frame.pieces.map(piece=>piece.sibling).join(','))).size>1,'交叉时必须换前后层，表现交错插牌')
  assert(washing.some(frame=>frame.pieces.some(piece=>Math.abs(piece.angle)>8)),'洗牌应有随运动变化的轻微旋转')
  assert(shuffleFrames.some(frame=>frame.time<.09&&frame.pieces.every(piece=>piece.scale.x>1.02&&piece.scale.y<.98)),'施放前应有可见的蓄力挤压')
  assert(washing.some(frame=>frame.impacts>0&&frame.pieces.some(piece=>piece.scale.y<.9)),'洗牌交错点应有短促压缩和冲击圈')
  assert(shuffleFrames.every(frame=>frame.pieces.every(piece=>piece.alpha===255)),'收牌、洗牌、候发牌都要保持可见，不能中途整叠消失')
  assert(shuffleFrames.some(frame=>frame.time>dealStart&&frame.pieces.some(piece=>piece.scale.y/piece.scale.x>2)&&frame.pieces.some(piece=>Math.abs(piece.position.x-recallPoint.x)<shuffle.c.pieceSize*.2&&piece.scale.x===.92)),'发牌时未发出的牌应留在牌叠里')
  assert(shuffleFrames.some(frame=>frame.time>dealStart&&frame.lines>0),'快速落回仍应有速度线')
  for(const frame of shuffleFrames.filter(frame=>frame.time>=dealStart))for(const piece of frame.pieces.filter(piece=>piece.scale.x===.72&&piece.scale.y===1.5))assert(Math.abs(piece.position.x-piece.targetX)<.001,'发牌短弧线结束后必须沿目标列垂直落下')
  assert(shuffleFrames.some(frame=>frame.time>dealStart&&frame.impacts>0&&frame.pieces.some(piece=>piece.scale.x>1.1&&piece.scale.y<.85)),'落地必须有明显挤压和地面爆点')
  assert(shuffleFrames.some(frame=>frame.time>dealStart&&frame.pieces.some((piece,i)=>piece.body.r>recallOrigins[i].body.r+20)),'落地应有短促的主体亮色反馈')
  assert.deepEqual(shuffleFrames.at(-1).pieces.map(piece=>piece.body),recallOrigins.map(piece=>piece.body),'落地短闪结束后必须还原原皮肤颜色')
  assert.equal(cues.filter(cue=>cue==='gather').length,1)
  assert(cues.filter(cue=>cue==='shuffle').length>=4)
  assert.equal(cues.filter(cue=>cue==='deal').length,3)
  assert.equal(cues.filter(cue=>cue==='land').length,3)
  assert.equal(shuffleAudio,0,'本轮只预留音效时机，不自动播放洗牌音效')
  assert(shuffle.c.board.flat().filter(Boolean).every(piece=>piece.node.angle===0),'落定后恢复棋子朝向')
  assert(shuffle.c.board.flat().filter(Boolean).every(piece=>piece.node.scale.x===1&&piece.node.scale.y===1),'落地反馈结束必须恢复尺寸，避免影响后续点选')
  assert.equal(shuffle.c.playEffects.shuffleTrail,null,'动画结束必须释放速度线')
  const completed=boardValues(shuffle.c),score=shuffle.c.scoreManager.getTotalScore(shuffle.c.board)
  const calls=env.randomCalls(),shuffleRestored=harness(fixed)
  await shuffleRestored.c.resumeStageOrSpawn()
  assert.deepEqual(boardValues(shuffleRestored.c),completed)
  assert.equal(shuffleRestored.c.scoreManager.getTotalScore(shuffleRestored.c.board),score)
  assert.equal(env.randomCalls(),calls,'恢复不能重抽打乱')
  await shuffleRestored.c.chooseStageEffect('shuffle');assert.deepEqual(boardValues(shuffleRestored.c),completed)
  const fallback=progression.shuffleBoard([[2,4]],x=>x,()=>.999)
  assert.deepEqual(plain(fallback.board),[[4,2]],'随机恰好原排列也要产生真实变化')
  for(const count of [2,8,35,56])for(const random of [()=>0,()=>.999999,()=>.5]) {
    const packed=Array.from({length:8},(_,r)=>Array.from({length:7},(_,c)=>r*7+c<count?2**((r*7+c)%8+1):null))
    const plan=plain(progression.shuffleBoard(packed,x=>x,random)),result=plan.board
    const heights=result[0].map((_,c)=>result.reduce((sum,row)=>sum+(row[c]!==null?1:0),0))
    assert(heights.filter(Boolean).length>=2,'随机数退化也不能全部回落到一列')
    assert(Math.max(...heights)<=8)
    const playedHeights=Array(7).fill(0)
    for(const drop of plan.drops)assert.equal(drop.row,playedHeights[drop.column]++,'同一列必须从底部逐颗回落，不能先落上层')
    assert.deepEqual(playedHeights,heights)
    assert.deepEqual(result.flat().filter(v=>v!==null).sort((a,b)=>a-b),packed.flat().filter(v=>v!==null).sort((a,b)=>a-b))
    for(let c=0;c<7;c++)for(let r=1;r<8;r++)if(result[r][c]!==null)assert.notEqual(result[r-1][c],null,'回落后不能产生悬空格')
  }
  const oneColumn=Array.from({length:8},(_,r)=>Array.from({length:7},(_,c)=>c===0?2**(r+1):null))
  const unbalanced=plain(progression.shuffleBoard(oneColumn,x=>x,()=>.5))
  assert(unbalanced.board[0].filter(v=>v!==null).length>=2,'原本只堆一列也要重新分配列位')
  assert(unbalanced.board[1].some(v=>v!==null),'随机分列应允许重复落同一列，不能强制平均铺满底行')
  let randomIndex=0
  const columnDraws=[.82,.05,.82,.44,.17,.17,.93,.44]
  const randomPlan=progression.shuffleBoard(oneColumn,x=>x,()=>randomIndex++<7?.999:columnDraws.shift())
  assert.deepEqual(plain(randomPlan.drops.map(drop=>drop.column)),[5,0,5,3,1,1,6,3],'每颗必须独立随机选列，保留重复列与折返顺序')
  const cancelled=harness();cancelled.put(0,0,32);cancelled.put(0,1,64);cancelled.put(1,0,128)
  cancelled.c.progression.highestMergeValue=1024;await cancelled.c.promoteIfReady()
  deferShuffle=true;const cancelling=cancelled.c.chooseStageEffect('shuffle');await Promise.resolve();await Promise.resolve()
  const committed=plain(cancelled.c.buildOngoingGameSnapshot())
  cancelled.c.stageRevision++;cancelled.c.playEffects.cancelShuffleRedeal();cancelled.c.playEffects.cancelShuffleRedeal()
  cancelled.c.node.isValid=false;cancelled.c.board=null;cancelled.c.uiController=null
  for(const late of delayed.splice(0))late()
  await cancelling;deferShuffle=false
  const cancelledRestored=harness(committed);await cancelledRestored.c.resumeStageOrSpawn()
  assert.equal(cancelledRestored.c.progression.choiceApplied,true)
  assert.equal(cancelledRestored.c.scoreManager.getBonusScore(),committed.bonusScore,'离场后晚到动画不能额外计分')

  const interrupted=harness();interrupted.put(0,0,1024);interrupted.c.progression.highestMergeValue=1024
  deferZoom=true;const zoom=interrupted.c.promoteIfReady()
  const safe=session.consumeSnapshot();assert.equal(safe.progression.phase,2)
  interrupted.c.stageRevision++;interrupted.c.cancelStageZoom()
  interrupted.c.node.isValid=false;interrupted.c.board=null;interrupted.c.uiController=null
  for(const late of delayed.splice(0))late()
  await zoom;deferZoom=false
  const afterInterrupt=harness(safe);await afterInterrupt.c.resumeStageOrSpawn()
  assert.equal(afterInterrupt.c.isWaitingForStageChoice(),true)
  assert.equal(afterInterrupt.c.board[0][1].getValue(),1024)

  const { StageChoicePopupController }=load('assets/script/gameplay/StageChoicePopupController.ts')
  const popup=new StageChoicePopupController(),host=new cc.Node('Overlay');host.addComponent(cc.UITransform).setContentSize(750,1700)
  popup.node=child(host,'Popup');popup.panel=child(popup.node,'Panel')
  popup.panelOpacity=popup.panel.addComponent(cc.UIOpacity)
  const mask=child(popup.node,'Mask');mask.addComponent(cc.Graphics);popup.maskOpacity=mask.addComponent(cc.UIOpacity)
  popup.cards=[0,1,2].map(i=>child(popup.panel,'Card'+i));popup.cards.forEach(node=>node.addComponent(cc.UIOpacity))
  popup.selections=popup.cards.map(node=>child(node,'Selected'));popup.confirmNode=child(popup.panel,'Confirm');popup.confirmNode.addComponent(cc.UIOpacity)
  popup.hint=child(popup.panel,'Hint').addComponent(cc.Label)
  let selected=0;popup.setup(()=>selected++);popup.onLoad();popup.show(false)
  assert.equal(mask.getComponent(cc.Graphics).fillColor.a,155,'遮罩自身 Alpha 必须收敛到目标值')
  popup.select('shuffle');assert.equal(popup.selected,null)
  popup.select('diagonal');popup.confirm();popup.confirm();assert.equal(selected,1)
  assert.equal(await popup.hide(),true);assert.equal(popup.node.active,false)
  assert.equal(mask.getComponent(cc.Graphics).fillColor.a,0)
  popup.show(true);popup.suspend()
  assert.equal(await popup.hide(),true,'停用后不再等待不活跃节点上的 Tween')
  assert(animationTrace.some(x=>x.duration===.24&&x.easing==='cubicOut'))
  assert(animationTrace.some(x=>x.duration===.18&&x.easing==='quadIn'))
  for(const node of [...popup.cards,popup.panel,mask,popup.confirmNode]) {
    node.isValid=false
    for(const c of node.components){c.isValid=false;c.node=null}
  }
  popup.dispose();popup.dispose()
  console.log(`${loose?'Creator loose':'原生编译'}：跨级晋级／平滑中间帧／八向合并／万能预览与绑定／回收逐颗回落与分列／固定结果续局／晚到回调／弹窗进出及重复释放通过`)
}

function verifyPrefab() {
  const file='assets/resources/base/Stage/StageChoicePopup.prefab',data=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))
  const visit=value=>{
    if(!value||typeof value!=='object')return
    if(value.__id__!==undefined)assert(data[value.__id__],`无效预制件引用 ${value.__id__}`)
    for(const item of Object.values(value))visit(item)
  }
  data.forEach(visit)
  for(const name of ['diagonalCard','wildcardCard','shuffleCard','Confirm','Panel','Mask'])assert.equal(data.filter(x=>x.__type__==='cc.Node'&&x._name===name).length,1)
  const labels=data.filter(x=>x.__type__==='cc.Label').map(x=>x._string)
  assert.equal(labels.filter(x=>x==='本局持续').length,2);assert.equal(labels.filter(x=>x==='立即一次').length,1)
  const files=['panel','diagonal','wildcard','shuffle','card','confirm'].map(name=>path.join(root,'assets/resources/base/Stage',name+'.png'))
  assert(files.reduce((sum,file)=>sum+fs.statSync(file).size,0)<512*1024)
  for(const name of ['diagonal','wildcard','shuffle']) {
    const png=fs.readFileSync(path.join(root,'assets/resources/base/Stage',name+'.png'))
    assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256)
  }
  console.log('预制件静态引用、三选一标签、图标像素和功能图片总预算通过')
}
(async()=>{verifyPrefab();await verify(false);await verify(true)})().catch(error=>{console.error(error);process.exitCode=1})

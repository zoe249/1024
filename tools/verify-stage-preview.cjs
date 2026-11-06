// 连接已经打开本项目的 Creator Web 预览，用隔离浏览器验证实际引擎与预制件。
// 不构建、不发布；阻断非本机请求，测试棋盘只存在于该浏览器会话。
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict')
const {spawn}=require('node:child_process')
const root=path.resolve(__dirname,'..')
const output=path.join(root,'design/晋级三选一弹窗/implementation-check')
fs.mkdirSync(output,{recursive:true})
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'1024-stage-preview-'))
const chrome=process.argv[2]||'C:/Program Files/Google/Chrome/Application/chrome.exe'
const scene=JSON.parse(fs.readFileSync(path.join(root,'assets/scence/game.scene.meta'),'utf8')).uuid
const previewPort=process.env.STAGE_PREVIEW_PORT||7456
const browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--mute-audio',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding',
  '--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=900,1500','about:blank'],{windowsHide:true,stdio:'ignore'})
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
let socket,id=0
const pending=new Map(),exceptions=[],consoleErrors=[]
function rpc(method,params={}) {
  return new Promise((resolve,reject)=>{
    const request=++id, timer=setTimeout(()=>{pending.delete(request);reject(new Error('CDP超时：'+method))},30000)
    pending.set(request,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}})
    socket.send(JSON.stringify({id:request,method,params}))
  })
}
async function evaluate(expression) {
  const result=await rpc('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text)
  return result.result.value
}
async function until(expression,label) {
  for(let i=0;i<120;i++){if(await evaluate(expression))return;await delay(250)}
  throw new Error('等待超时：'+label)
}
async function capture(name) {
  const clip=await evaluate(`(()=>{const r=(document.querySelector('#GameDiv')||document.querySelector('canvas')).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`)
  const image=await rpc('Page.captureScreenshot',{format:'png',clip,captureBeyondViewport:true})
  fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(image.data,'base64'))
}
async function clickNode(expression) {
  const point=await evaluate(`(()=>{const node=${expression};const canvas=__stageCc.director.getScene().getChildByName('Canvas').getComponent(__stageCc.Canvas);const p=canvas.cameraComponent.worldToScreen(node.worldPosition);const r=document.querySelector('canvas').getBoundingClientRect();const element=document.querySelector('canvas');return{x:r.x+p.x/element.width*r.width,y:r.bottom-p.y/element.height*r.height}})()`)
  await rpc('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point})
  await rpc('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point})
}
async function verifyBoardInput() {
  await evaluate(`(()=>{const c=__stageQa;c.__qaSpeeds=[c.fallSpeed,c.fastFallSpeed];c.fallSpeed=0;c.fastFallSpeed=0;c.isPaused=false;c.node.on(__stageCc.Node.EventType.TOUCH_START,event=>{window.__stageLastTouch={ui:event.getUILocation(),screen:event.getLocation(),column:c.getColumnFromTouch(event)}});return true})()`)
  const hits=[]
  for(const type of ['mouse','touch'])for(let column=0;column<7;column++)for(const offset of [-.4,0,.4]) {
    const point=await evaluate(`(()=>{const c=__stageQa,canvas=__stageCc.director.getScene().getChildByName('Canvas').getComponent(__stageCc.Canvas),position=c.node.getComponent(__stageCc.UITransform).convertToWorldSpaceAR(c.getCellPosition(6,${column}).add3f(c.getStepSize()*${offset},0,0)),p=canvas.cameraComponent.worldToScreen(position),element=document.querySelector('canvas'),r=element.getBoundingClientRect();return{x:r.x+p.x/element.width*r.width,y:r.bottom-p.y/element.height*r.height}})()`)
    if(type==='mouse') {
      await rpc('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point})
      await rpc('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point})
    } else {
      await rpc('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]})
      await rpc('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    }
    await evaluate(`new Promise(resolve=>__stageCc.director.once(__stageCc.Director.EVENT_AFTER_UPDATE,resolve))`)
    const hit=await evaluate(`({current:__stageQa.currentColumn,pieceX:__stageQa.currentPiece?.node.position.x,expectedX:__stageQa.getCellPosition(0,${column}).x,last:window.__stageLastTouch})`)
    hits.push({type,column,offset,point,...hit})
  }
  await evaluate(`(()=>{const c=__stageQa;[c.fallSpeed,c.fastFallSpeed]=c.__qaSpeeds;return true})()`)
  assert.deepEqual(hits.map(hit=>hit.current),hits.map(hit=>hit.column),JSON.stringify(hits))
  for(const hit of hits)assert(Math.abs(hit.pieceX-hit.expectedX)<.1,JSON.stringify(hit))
  return hits
}
async function main() {
  const portFile=path.join(profile,'DevToolsActivePort')
  for(let i=0;!fs.existsSync(portFile)&&i<80;i++)await delay(100)
  assert(fs.existsSync(portFile),'Chrome 调试端口未就绪')
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0]
  const pages=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()
  const page=pages.find(page=>page.type==='page')
  socket=new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data)
    if(message.id){const request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(new Error(JSON.stringify(message.error))):request.resolve(message.result)}}
    else if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text)
    else if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')consoleErrors.push(message.params.args.map(x=>x.value||x.description).join(' '))
    else if(message.method==='Fetch.requestPaused'){
      const {requestId,request}=message.params,url=new URL(request.url)
      const local=['localhost','127.0.0.1','::1'].includes(url.hostname)||['data:','blob:'].includes(url.protocol)
      void rpc(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'}).catch(()=>{})
    }
  })
  await rpc('Page.enable');await rpc('Runtime.enable');await rpc('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]})
  if(process.env.STAGE_PREVIEW_DPR)await rpc('Emulation.setDeviceMetricsOverride',{width:900,height:1500,deviceScaleFactor:Number(process.env.STAGE_PREVIEW_DPR),mobile:false})
  await rpc('Page.navigate',{url:'http://127.0.0.1:'+previewPort+'/?scene='+scene})
  await until(`document.readyState==='complete'&&typeof System!=='undefined'&&!!window._CCSettings`,'引擎脚本与预览配置')
  await evaluate(`(async()=>{window.__stageCc=await System.import('cc');return true})()`)
  await until(`!!window.__stageCc.director.getScene()?.getChildByName('Canvas')?.getChildByName('Main')?.getComponent('PlayController')`,'游戏入口')
  const boot=await evaluate(`(()=>{window.__stageQa=__stageCc.director.getScene().getChildByName('Canvas').getChildByName('Main').getComponent('PlayController');return{scene:__stageCc.director.getScene().name,width:__stageQa.boardwidth,rows:__stageQa.boardheight}})()`)
  assert.equal(boot.scene,'game')
  const reports=[]
  for(const choice of ['diagonal','wildcard','shuffle']) {
    const first=await evaluate(`(async()=>{
      const c=__stageQa;c.stageRevision++;c.cancelStageZoom();c.clearBoardPieces();c.clearTransientEffects();
      c.applyBoardConfig({columns:5,rows:7});c.resetBoard();c.applyStageLayout(1);
      c.hasStartedSession=true;c.isGameOver=false;c.isPaused=false;c.isResolving=false;c.firstEntryTutorialStep=0;
      const seed=${choice==='shuffle'?`[[0,0,2],[1,0,4],[0,1,8],[0,2,16],[1,2,32],[2,2,64],[0,3,128],[0,4,256],[1,4,512]]`:`[[0,0,32],[0,1,2],[1,1,32],[0,3,256]]`};
      for(const [r,col,value] of seed){const p=c.instantiateSnapshotPiece(value);c.board[r][col]=p;p.node.setPosition(c.getCellPosition(r,col));}
      c.progression.highestMergeValue=1024;
      window.__stageZoomPromise=c.promoteIfReady();
      await new Promise(resolve=>setTimeout(resolve,200));
      const intermediate=c.pieceSize;
      ${choice==='diagonal'?`c.enabled=false;await __stageZoomPromise;c.enabled=true;`:`await __stageZoomPromise;`}
      const transform=c.node.getComponent(__stageCc.UITransform);
      const columnHits=Array.from({length:7},(_,column)=>{const point=transform.convertToWorldSpaceAR(c.getCellPosition(0,column));return c.getColumnFromTouch({getUILocation:()=>point});});
      return{original:c.originalPieceSize,intermediate,final:c.pieceSize,columns:c.boardwidth,rows:c.boardheight,columnHits};
    })()`)
    assert(first.intermediate<first.original&&first.intermediate>first.final)
    assert.equal(first.columns,7);assert.equal(first.rows,8)
    assert.deepEqual(first.columnHits,[0,1,2,3,4,5,6],'七列显示中心与实际触摸换算必须一致')
    await until(`__stageQa.uiController.stagePopup?.shown===true&&__stageQa.uiController.stagePopup.entering===false&&__stageQa.uiController.stagePopup.panelOpacity.opacity===255`,'三选一预制件入场动画完成')
    await capture('stage-'+choice+'-popup')
    const popup=await evaluate(`(()=>{const p=__stageQa.uiController.stagePopup;return{cards:p.cards.length,title:p.panel.getChildByName('Title').getComponent(__stageCc.Label).string,panelSize:p.panel.getComponent(__stageCc.UITransform).contentSize,mask:p.maskOpacity.opacity,maskFill:p.maskOpacity.node.getComponent(__stageCc.Graphics).fillColor.a,panelOpacity:p.panelOpacity.opacity,children:p.node.children.map(n=>n.name)}})()`)
    assert.equal(popup.maskFill,155,'Graphics 遮罩自身 Alpha 必须跟随动画')
    assert.equal(popup.cards,3);assert.equal(popup.title,'进入第二阶段')
    const index=['diagonal','wildcard','shuffle'].indexOf(choice)
    await clickNode(`__stageQa.uiController.stagePopup.cards[${index}]`)
    assert.equal(await evaluate(`__stageQa.uiController.stagePopup.selected`),choice,'卡片必须能通过真实鼠标触摸映射选择')
    if(choice==='diagonal'){await delay(220);await capture('stage-diagonal-selected')}
    if(choice==='shuffle')await evaluate(`(()=>{
      window.__shuffleFrames=[];
      const c=__stageQa,play=c.playEffects.playShuffleRedeal.bind(c.playEffects);
      c.playEffects.playShuffleRedeal=(targets,gather,alive,feedback)=>{window.__shuffleTargets=targets.map(target=>({x:target.position.x,y:target.position.y}));window.__shuffleOrigins=new Map(targets.map(target=>[target.node.uuid,{x:target.node.position.x,y:target.node.position.y}]));window.__shuffleGather={x:gather.x,y:gather.y};window.__shuffleCues=[];return play(targets,gather,alive,cue=>{__shuffleCues.push({cue,time:c.playEffects.shuffleClock?.time});feedback?.(cue);});};
      window.__shuffleTracker=()=>{const c=__stageQa,clock=c.playEffects.shuffleClock;if(!clock)return;const nodes=c.board.flat().filter(Boolean).map(p=>p.node);__shuffleFrames.push({time:clock.time,visible:nodes.filter(n=>(n.getComponent(__stageCc.UIOpacity)?.opacity??255)>4).length,fullVisible:nodes.every(n=>(n.getComponent(__stageCc.UIOpacity)?.opacity??255)>=250&&n.scale.x>=.82),recallMoved:nodes.some(n=>{const origin=__shuffleOrigins.get(n.uuid);return Math.hypot(n.position.x-origin.x,n.position.y-origin.y)>c.pieceSize}),spread:Math.max(...nodes.map(n=>n.position.x))-Math.min(...nodes.map(n=>n.position.x)),firstX:nodes[0].position.x-__shuffleGather.x,order:nodes.map(n=>n.getSiblingIndex()).join(','),onDeck:nodes.filter(n=>Math.hypot(n.position.x-__shuffleGather.x,n.position.y-__shuffleGather.y)<c.pieceSize*.35&&Math.abs(n.scale.x-.92)<.001).length,angle:Math.max(...nodes.map(n=>Math.abs(n.angle))),landingSquash:nodes.some(n=>n.scale.x>1.12&&n.scale.y<.85),resolving:c.isResolving,count:nodes.length,bonus:c.scoreManager.getBonusScore(),speedLines:!!c.playEffects.shuffleTrail?.isValid});};
      __stageCc.director.on(__stageCc.Director.EVENT_AFTER_UPDATE,__shuffleTracker);
      const chunks=[],stream=document.querySelector('canvas').captureStream(60);
      window.__shuffleRecorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:1800000});
      window.__shuffleVideo=new Promise(resolve=>{__shuffleRecorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)};__shuffleRecorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());const reader=new FileReader();reader.onloadend=()=>resolve(reader.result);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));};});
      __shuffleRecorder.start();return true;
    })()`)
    await clickNode(`__stageQa.uiController.stagePopup.confirmNode`)
    if(choice==='shuffle'){
      await until(`!!__stageQa.playEffects.shuffleClock`,'全部方块回收动画')
      await delay(200);await capture('shuffle-charge-v5')
      await delay(320);await capture('shuffle-impact-v5')
      await delay(850);await capture('shuffle-landing-v5')
    }
    await until(`__stageQa.progression.choiceApplied&&!__stageQa.isResolving`,'首次效果结算')
    const after=await evaluate(`(()=>{const c=__stageQa;return{choice:c.progression.choice,applied:c.progression.choiceApplied,popupActive:c.uiController.stagePopup.node.active,currentValue:c.currentPiece?.getValue(),score:c.scoreManager.getTotalScore(c.board)}})()`)
    assert.equal(after.choice,choice);assert.equal(after.popupActive,false)
    if(choice==='shuffle'){
      after.shuffleFrames=await evaluate(`(()=>{__stageCc.director.off(__stageCc.Director.EVENT_AFTER_UPDATE,__shuffleTracker);__shuffleRecorder.stop();return __shuffleFrames})()`)
      const video=await evaluate(`__shuffleVideo`)
      fs.writeFileSync(path.join(output,'shuffle-redeal-v5.webm'),Buffer.from(video.split(',')[1],'base64'))
      const washing=after.shuffleFrames.filter(frame=>frame.time>=.542&&frame.time<1.322)
      assert(after.shuffleFrames.some(frame=>frame.time>.18&&frame.time<.46&&frame.fullVisible&&frame.recallMoved),'实际引擎必须清晰展示弧线收牌')
      assert(washing.some(frame=>frame.spread>120&&frame.angle>8),'实际引擎必须看到两叠拉开、旋转穿插')
      assert(washing.some(frame=>frame.firstX>40)&&washing.some(frame=>frame.firstX< -40),'实际引擎必须看到牌叠交叉换边')
      assert(new Set(washing.map(frame=>frame.order)).size>1,'实际引擎洗牌必须交换牌的前后层')
      assert(after.shuffleFrames.some(frame=>frame.time>1.422&&frame.onDeck>0&&frame.onDeck<frame.count&&frame.speedLines),'发牌时剩余牌叠应保持可见')
      assert(after.shuffleFrames.some(frame=>frame.time>1.422&&frame.landingSquash),'落地必须有明显的挤压反馈')
      after.feedbackCues=await evaluate(`__shuffleCues`)
      for(const cue of ['gather','shuffle','deal','land'])assert(after.feedbackCues.some(item=>item.cue===cue),'缺少音效接入时机：'+cue)
      const poseErrors=await evaluate(`(()=>{const c=__stageQa,errors=[];c.board.forEach((row,r)=>row.forEach((p,col)=>{if(!p)return;const n=p.node,target=c.getCellPosition(r,col);if(Math.hypot(n.position.x-target.x,n.position.y-target.y)>.5||Math.abs(n.angle)>.01||Math.abs(n.scale.x-1)>.01||Math.abs(n.scale.y-1)>.01)errors.push({r,col});}));return errors})()`)
      assert.deepEqual(poseErrors,[],'落定后必须恢复位置、朝向和大小')
      assert(after.shuffleFrames.every(frame=>frame.resolving&&frame.count===9&&frame.visible===9&&frame.bonus===after.shuffleFrames[0].bonus),'动画期间牌始终可见、锁定输入且不新增棋子或合并计分')
      const heights=await evaluate(`__stageQa.board[0].map((_,c)=>__stageQa.board.filter(row=>row[c]).length)`)
      assert(heights.filter(Boolean).length>=2,'原本一列的七颗方块不能全部回同一列')
      after.dropTargets=await evaluate(`__shuffleTargets`)
    }
    after.actualInput=await verifyBoardInput()
    if(choice==='wildcard') {
      const wild=await evaluate(`(()=>{const c=__stageQa;while(c.progression.spawnedSinceChoice<6){c.currentPiece?.node.destroy();c.currentPiece=null;c.spawnPiece();}return{spawned:c.progression.spawnedSinceChoice,kind:c.currentPieceKind,label:c.currentPiece.node.getChildByName('Value').getComponent(__stageCc.Label).string,next:c.nextKind}})()`)
      assert.equal(wild.kind,'wildcard');assert.equal(wild.label,'万能');reports.push({choice,zoom:first,popup,after,wild})
    } else reports.push({choice,zoom:first,popup,after})
    await capture('stage-'+choice+'-after')
  }
  const interruptedRedeals=[]
  for(const interruptAt of [.25,.85,1.65]){
    await evaluate(`(()=>{const c=__stageQa;c.clearTransientEffects();c.clearBoardPieces();c.board=c.boardModel.createEmptyBoard(8,7);c.progression.choice=null;c.progression.choiceApplied=false;c.isResolving=false;c.isPaused=false;for(let r=0;r<7;r++){const p=c.instantiateSnapshotPiece(2**(r+1));c.board[r][0]=p;p.node.setPosition(c.getCellPosition(r,0));}window.__interruptedRedeal=c.chooseStageEffect('shuffle');return true})()`)
    await until(`(__stageQa.playEffects.shuffleClock?.time??-1)>=${interruptAt}`,'回收或回落中途停用')
    const checkpoint=await evaluate(`(()=>{const c=__stageQa,s=JSON.parse(JSON.stringify(c.buildOngoingGameSnapshot()));c.enabled=false;c.enabled=true;return s})()`)
    await until(`__stageQa.progression.choiceApplied&&!__stageQa.isResolving`,'打乱中断恢复')
    const restored=await evaluate(`(()=>{const c=__stageQa;return{boardValues:c.board.map(row=>row.map(p=>p?.getValue()??null)),bonus:c.scoreManager.getBonusScore(),clock:c.playEffects.shuffleClock}})()`)
    assert.deepEqual(restored.boardValues,checkpoint.boardValues);assert.equal(restored.bonus,checkpoint.bonusScore);assert.equal(restored.clock,null)
    interruptedRedeals.push({interruptAt,restored:true})
  }
  const ordinary=await evaluate(`(()=>{const element=document.querySelector('#GameDiv');element.style.width='375px';element.style.height='667px';__stageCc.view.setFrameSize(375,667);__stageQa.isPaused=true;__stageQa.uiController.syncLayout();const p=__stageQa.uiController.stagePopup;p.show(true);return true})()`)
  await delay(150)
  await evaluate(`__stageQa.uiController.syncLayout()`)
  await until(`__stageQa.uiController.stagePopup.entering===false&&__stageQa.uiController.stagePopup.panelOpacity.opacity===255`,'普通屏弹窗动画')
  const ordinaryLayout=await evaluate(`(()=>{const c=__stageQa,p=c.uiController.stagePopup;return{canvas:document.querySelector('canvas').getBoundingClientRect().toJSON(),popup:p.panel.getComponent(__stageCc.UITransform).getBoundingBoxToWorld(),visible:__stageCc.view.getVisibleSize()}})()`)
  assert.equal(ordinaryLayout.canvas.width,375);assert.equal(ordinaryLayout.canvas.height,667)
  assert(ordinaryLayout.popup.x>=0&&ordinaryLayout.popup.y>=0&&ordinaryLayout.popup.x+ordinaryLayout.popup.width<=ordinaryLayout.visible.width&&ordinaryLayout.popup.y+ordinaryLayout.popup.height<=ordinaryLayout.visible.height,'普通屏弹窗必须完整落在可见范围内')
  await capture('stage-ordinary-screen')
  const fatal=exceptions.filter(message=>!message.includes('ERR_BLOCKED_BY_CLIENT'))
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({boot,reports,ordinaryLayout,interruptedRedeals,exceptions:fatal,consoleErrors},null,2)+'\n')
  assert.equal(fatal.length,0,'引擎预览出现未捕获异常：'+fatal.join('\n'))
  if(fs.existsSync(path.join(output,'failure.json')))fs.unlinkSync(path.join(output,'failure.json'))
  console.log(JSON.stringify({creatorWebPreview:'pass',choices:reports.map(x=>x.choice),zoomIntermediateFrames:true,popupAnimations:true,interruptResume:true,shuffleRedeal:true,interruptedRedeals,wildcardSixth:true,ordinaryScreen:!!ordinary,output}))
}
main().catch(async error=>{const popup=socket?await evaluate(`(()=>{const p=window.__stageQa?.uiController?.stagePopup;return p?{keys:Object.keys(p),shown:p.shown,entering:p.entering,mask:p.maskOpacity?.opacity,fill:p.maskOpacity?.node.getComponent(__stageCc.Graphics).fillColor,opacity:p.panelOpacity?.opacity,show:String(p.show),drawMask:String(p.drawMask)}:null})()`).catch(()=>null):null;fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:String(error),popup,exceptions,consoleErrors},null,2)+'\n');console.error(error);process.exitCode=1}).finally(()=>{socket?.close();browser.kill()})

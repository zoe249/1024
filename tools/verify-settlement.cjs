// 校验真实 Prefab 和组件时序；不替代 Creator/微信的视觉验收。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require(process.argv[2] || 'typescript')
const root = path.resolve(__dirname, '..')
function load(file, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, experimentalDecorators: true } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports, require: name => { assert.ok(name in dependencies, name); return dependencies[name] }, console, ...globals }, { filename: file })
  return module.exports
}
const presentation = load('assets/script/settlement/SettlementPresentation.ts', {})
const pieceStyles = load('assets/script/gameplay/PieceStyle.ts', {})
for (const [value, expected] of [[0,'0'],[3560,'3,560'],[568888,'568,888'],[1258880,'1,258,880'],[999999999,'999,999,999'],[1000000000,'1,000,000,000']]) assert.equal(presentation.formatSettlementScore(value), expected)
const entry = (rank, self = false, value = 600000 - rank * 1000) => ({ rank, displayName: self ? '自己' : '这是一个非常非常长的玩家昵称', value, avatarIndex: rank % 11, isSelf: self })
const result = (previous, current, extra = {}) => ({ previous, current, operationId: 'finish', self: entry(current, true), entries: Array.from({ length: Math.max(previous || 0, current) + 5 }, (_, i) => i + 1).filter(rank => rank !== current).map(rank => entry(rank)), celebrate: previous === null || previous > current, ...extra })
const scenarios = [result(21, 13), result(121, 13), result(7, 1), result(13, 13), result(null, 13), result(21, 13, { self: entry(13, true, 1_000_000_000) })]
for (const data of scenarios) {
  const track = presentation.buildSettlementTrack(data)
  let last = Infinity
  for (let time = 0; time <= 6200; time += 16) {
    const frame = presentation.settlementFrame(track, time)
    assert.ok(frame.rank <= last, '名次倒退'); last = frame.rank
    assert.ok(Number.isFinite(frame.selfY) && frame.selfScale >= 1)
    const visible = frame.rows.filter(row => Math.abs(row.y) < presentation.SETTLEMENT_LIST_HEIGHT / 2 + presentation.SETTLEMENT_ROW_STEP / 2)
    const ranks = visible.map(row => row.rank)
    assert.equal(new Set([...ranks, frame.rank]).size, ranks.length + 1, JSON.stringify({previous:data.previous,current:data.current,time,rank:frame.rank,position:frame.position,ranks}))
    assert.ok(visible.length <= 8, '超过渲染池上限')
  }
  const end = presentation.settlementFrame(track, 6200)
  assert.equal(end.rank, data.current); assert.equal(end.done, true)
  const around = end.rows.filter(row => Math.abs(row.y) < presentation.SETTLEMENT_LIST_HEIGHT / 2).map(row => row.rank).concat([end.rank]).sort((a, b) => a - b)
  for (let i = 1; i < around.length; i++) assert.equal(around[i], around[i - 1] + 1)
}
// 稀疏快照跨百万名，中段允许跳号，首尾保留连续真实邻居。
const sparse = result(1_000_000, 13, { entries: [9,10,11,12,14,15,16,17,150000,300000,600000,999996,999997,999998,999999,1000000,1000001,1000002].map(rank=>entry(rank)) })
const st = presentation.buildSettlementTrack(sparse)
assert.equal(presentation.settlementFrame(st, 0).rank, 1_000_000)
assert.equal(presentation.settlementFrame(st, 6200).rank, 13)
assert.ok(st.landing + 340 <= 3070)
for (const [top, first, count, duration] of [[false,false,96,2600],[true,false,144,3000],[false,true,36,1900]]) {
  const particles = presentation.makeCelebration(top, first)
  assert.equal(particles.length, count)
  assert.deepEqual(JSON.stringify(particles), JSON.stringify(presentation.makeCelebration(top, first)))
  for (let time=0;time<duration;time+=17) for(const particle of particles){const f=presentation.particleFrame(particle,time);if(f)for(const value of Object.values(f))assert.ok(Number.isFinite(value))}
  assert.ok(particles.every(p=>presentation.particleFrame(p,duration)===null))
}
const buttonScene=JSON.parse(fs.readFileSync(path.join(root,'assets/scence/game.scene'),'utf8')).find(x=>x.gameOverHomeButtonSpriteFrame);
const buttonPrefab=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/Settlement/SettlementPopup.prefab'),'utf8'));
for(const [name,key]of [['Home','gameOverHomeButtonSpriteFrame'],['Replay','gameOverReplayButtonSpriteFrame'],['Share','gameOverShareButtonSpriteFrame']]){const n=buttonPrefab.find(x=>x.__type__==='cc.Node'&&x._name===name);const artwork=buttonPrefab[n._children[0].__id__];const sprite=artwork._components.map(r=>buttonPrefab[r.__id__]).find(x=>x.__type__==='cc.Sprite');assert.equal(sprite._spriteFrame.__uuid__,buttonScene[key].__uuid__);assert.equal(artwork._name,'Artwork');}
console.log('纯动画：六种情景、百万名压缩、连续最终名次、三档彩纸及收尾通过')

let reduced=false, resourceLoads=[], animations=[]
class Vec3 { constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})} static ONE=new Vec3(1,1,1) }
class Component { constructor(){this.isValid=true} }
class Node {
  static EventType={TOUCH_START:'start',TOUCH_MOVE:'move',TOUCH_END:'end',TOUCH_CANCEL:'cancel'}
  constructor(name=''){Object.assign(this,{name,children:[],components:[],parent:null,active:true,isValid:true,layer:33554432,position:new Vec3(),scale:Vec3.ONE,events:new Map()})}
  setParent(parent){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=parent;parent.children.push(this)}
  getChildByName(name){return this.children.find(n=>n.name===name)||null}
  getChildByPath(p){return p.split('/').reduce((node,part)=>node?.getChildByName(part),this)||null}
  addComponent(Type){const c=new Type();c.node=this;this.components.push(c);return c}
  getComponent(Type){return this.components.find(c=>c instanceof Type)||null}
  setPosition(x,y,z=0){this.position=x instanceof Vec3?x:new Vec3(x,y,z)}
  setScale(x,y,z=1){this.scale=x instanceof Vec3?x:new Vec3(x,y,z)}
  setSiblingIndex(index){if(!this.parent)return;const a=this.parent.children;a.splice(a.indexOf(this),1);a.splice(index,0,this)}
  on(event,fn,owner){const list=this.events.get(event)||[];list.push({fn,owner});this.events.set(event,list)}
  off(event,fn,owner){if(!this.events)throw new TypeError("null is not an object (evaluating 'this._eventProcessor.off')");this.events.set(event,(this.events.get(event)||[]).filter(x=>x.fn!==fn||x.owner!==owner))}
}
class UITransform extends Component {setContentSize(w,h){this.width=w;this.height=h}}
class Label extends Component { static Overflow={SHRINK:2};static HorizontalAlign={CENTER:1};static VerticalAlign={CENTER:1};constructor(){super();this.string=''} }
class Graphics extends Component { clear(){this.operations=0;this.strokes=[];this.fills=[]} }
for(const name of ['rect','roundRect','moveTo','lineTo','circle','arc','bezierCurveTo','close','fill','stroke'])Graphics.prototype[name]=function(...args){for(const x of args)if(typeof x==='number')assert.ok(Number.isFinite(x));this.operations=(this.operations||0)+1;if(name==='stroke')(this.strokes??=[]).push({width:this.lineWidth,color:this.strokeColor});if(name==='fill')(this.fills??=[]).push(this.fillColor)}
class Sprite extends Component{static SizeMode={CUSTOM:0}}
class SpriteFrame{}
class Prefab{}
class Mask extends Component{}
class UIOpacity extends Component {constructor(){super();this.opacity=255}}
const eventBus=new Map()
const game={on(event,fn,owner){const list=eventBus.get(event)||[];list.push({fn,owner});eventBus.set(event,list)},off(event,fn,owner){eventBus.set(event,(eventBus.get(event)||[]).filter(x=>x.fn!==fn||x.owner!==owner))}}
const Game={EVENT_HIDE:'hide',EVENT_SHOW:'show'}
const emit=event=>(eventBus.get(event)||[]).slice().forEach(x=>x.fn.call(x.owner))
const Tween={stopAllByTarget(target){animations=animations.filter(a=>a.target!==target)}}
function tween(target){const actions=[];return{to(time,props){actions.push(()=>Object.assign(target,props));return this},call(fn){actions.push(fn);return this},start(){animations.push({target,actions})}}}
const stepButtons=()=>{const items=animations;animations=[];items.forEach(a=>a.actions.forEach(fn=>fn()))}
class Avatar {constructor(sprite){this.sprite=sprite;this.cleared=0;this.disposed=false}render(entry){this.entry=entry;return Promise.resolve(true)}clear(){this.cleared++;this.entry=null}dispose(){this.clear();this.disposed=true}}
const prefab=JSON.parse(fs.readFileSync(path.join(root,'assets/resources/Settlement/SettlementPopup.prefab'),'utf8'))
const types={'cc.UITransform':UITransform,'cc.Label':Label,'cc.Sprite':Sprite,'cc.Graphics':Graphics,'cc.Mask':Mask,'cc.UIOpacity':UIOpacity}
function deserialize(){const nodes=new Map();prefab.forEach((x,i)=>{if(x.__type__==='cc.Node'){const n=new Node(x._name);n.active=x._active;n.setPosition(x._lpos.x,x._lpos.y,x._lpos.z);nodes.set(i,n)}});for(const [id,n]of nodes){const x=prefab[id];if(x._parent)n.setParent(nodes.get(x._parent.__id__));for(const ref of x._components){const c=prefab[ref.__id__],Type=types[c.__type__];assert.ok(Type,c.__type__);const value=n.addComponent(Type);if(Type===UITransform)value.setContentSize(c._contentSize.width,c._contentSize.height);if(Type===Sprite)value.spriteFrame=c._spriteFrame?new SpriteFrame():null;if(Type===Label){value.string=c._string;value.fontSize=c._fontSize;value.overflow=c._overflow;value.enableWrapText=c._enableWrapText;value.isBold=c._isBold;value.fontFamily=c._fontFamily;value.outlineWidth=c._outlineWidth}}}for(const [id,n]of nodes)n.children=prefab[id]._children.map(ref=>nodes.get(ref.__id__));return nodes.get(prefab[0].data.__id__)}
function clone(n){const copy=new Node(n.name);const t=n.getComponent(UITransform);if(t)copy.addComponent(UITransform).setContentSize(t.width,t.height);for(const c of n.components.filter(c=>!(c instanceof UITransform))){const nc=copy.addComponent(c.constructor);if(c instanceof Sprite)nc.spriteFrame=c.spriteFrame;if(c instanceof Label)Object.assign(nc,{string:c.string,fontSize:c.fontSize,overflow:c.overflow,enableWrapText:c.enableWrapText})}for(const child of n.children)clone(child).setParent(copy);return copy}
const cc={_decorator:{ccclass:()=>Type=>Type},Color:class{constructor(r,g,b,a=255){Object.assign(this,{r,g,b,a})}static fromHEX(out,hex){const n=Number.parseInt(hex.replace('#',''),16);Object.assign(out,{r:n>>>16&255,g:n>>>8&255,b:n&255,a:255});return out}},Component,EventTouch:class{},game,Game,Graphics,instantiate:p=>p instanceof Node?clone(p):deserialize(),Label,Node,Prefab,resources:{load(...args){resourceLoads.push(args.at(-1))}},Sprite,SpriteFrame,tween,Tween,UIOpacity,UITransform,Vec3}
const {GameOverOverlayController}=load('assets/script/settlement/GameOverOverlayController.ts',{cc,'../profile/PlayerAvatarRenderer':{PlayerAvatarRenderer:Avatar},'../gameplay/PieceStyle':pieceStyles,'./SettlementPresentation':presentation},{matchMedia:()=>({matches:reduced})})
function harness(width=750,height=1334,fallback=false){resourceLoads=[];const controller=new GameOverOverlayController();controller.node=new Node('Overlay');const parent=new Node('Root');controller.node.setParent(parent);const host=new Node('Content');host.addComponent(UITransform).setContentSize(width,height);const calls=[0,0,0];controller.setup({hostNode:host,homeHandler:()=>calls[0]++,replayHandler:()=>calls[1]++,shareHandler:()=>calls[2]++,homeButtonSpriteFrame:new SpriteFrame(),replayButtonSpriteFrame:new SpriteFrame(),shareButtonSpriteFrame:new SpriteFrame()});controller.onEnable();return{controller,calls,ready(){resourceLoads.shift()(fallback?Error('fixture'):null,fallback?null:{});return controller}}}
for(const [width,height]of[[640,1136],[750,1334],[860,1864]])for(const data of scenarios){const h=harness(width,height),c=h.controller;c.renderState(true,52880,2048,128);c.renderRank(data,false);assert.equal(c.track,null);h.ready();assert.equal(c.scoreLabel.string,'52,880');assert.equal(c.rows.length,8);assert.ok(c.layoutScale*1360<=height-64+0.01);assert.ok(c.layoutScale*750<=width-40+0.01);for(let i=0;i<390;i++)c.update(0.016);assert.equal(c.playing,false);assert.equal(c.paper.length,0);assert.equal(c.rankLabel.string,`第 ${data.current} 名`);assert.equal(c.rankNumber.string,String(data.current));assert.equal(c.rankNumber.node.parent.active,true);assert.equal(c.rankLabel.node.active,false);if(data.current===1)assert.equal(c.statusLabel.string,'已登顶');assert.equal(c.selfRow.score.string,presentation.formatSettlementScore(data.self.value));assert.equal(c.selfRow.node.scale.x,1);assert.equal(c.selfRow.score.outlineWidth,0.5);assert.equal(c.statusLabel.isBold,false);assert.equal(c.statusLabel.fontFamily,'"Microsoft YaHei","PingFang SC",sans-serif');const border=c.selfRow.node.getComponent(Graphics).strokes[0];assert.equal(border.width,1.2);assert.equal(JSON.stringify(border.color),JSON.stringify({r:116,g:68,b:38,a:170}));for(const [index,frame]of [c.options.homeButtonSpriteFrame,c.options.replayButtonSpriteFrame,c.options.shareButtonSpriteFrame].entries()){const b=c.buttons[index];assert.equal(b.getChildByName('Artwork').getComponent(Sprite).spriteFrame,frame);assert.equal(b.getComponent(Graphics),null);assert.equal(b.getComponent(UITransform).width,index===2?316:126);assert.equal(b.getChildByName('Artwork').getComponent(UITransform).height,126)}assert.equal(c.selfRow.medal.node.active,data.current<=3);assert.equal(c.selfRow.rank.node.active,data.current>3);for(const row of c.rows.filter(r=>r.node.active)){assert.equal(row.score.overflow,2);assert.equal(row.score.enableWrapText,false);assert.ok(row.name.string.endsWith('…'))}c.onDestroy()}
console.log('真实 Prefab/组件：18 种屏幕情景、历史最佳与本局分离、十位数 SHRINK、昵称省略、单次动画通过')
const safe=harness();safe.controller.options.getSafeInsets=()=>({top:120,bottom:68});safe.controller.renderState(true,1,2,5);safe.ready();for(let i=0;i<32;i++){safe.controller.update(.01);const panel=safe.controller.panel;assert.ok(panel.position.y+1360*panel.scale.y/2<=1334/2-120);assert.ok(panel.position.y-1360*panel.scale.y/2>=-1334/2+68)}safe.controller.syncLayout();assert.ok(safe.controller.panel.position.y+1360*safe.controller.layoutScale/2<=1334/2-120-32+0.01);assert.ok(safe.controller.panel.position.y-1360*safe.controller.layoutScale/2>=-1334/2+68+32-0.01);safe.controller.onDestroy();
const h=harness(),c=h.controller;c.renderState(true,1000,128,10);h.ready();c.renderRank(null,true);assert.equal(c.rankLabel.string,'名次计算中');c.renderRank(scenarios[0],false);for(let i=0;i<180;i++)c.update(.016);assert.ok(c.paper.length);emit('hide');assert.equal(c.playing,false);assert.equal(c.paper.length,0);assert.equal(c.rankLabel.string,'第 13 名');emit('show');assert.equal(c.playing,false);for(let i=0;i<3;i++){c.act({propagationStopped:false},i);stepButtons()}assert.deepEqual(h.calls,[1,1,1]);c.renderState(false,0,0,0);c.onDisable();c.renderState(true,2000,256,20);c.onEnable();c.renderRank(scenarios[2],false);assert.equal(c.elapsed,0);c.update(.8);c.onDestroy();assert.equal([...eventBus.values()].flat().length,0);assert.equal(animations.length,0)
reduced=true;const r=harness();r.controller.renderState(true,1,2,5);r.ready();r.controller.renderRank(scenarios[2],false);assert.equal(r.controller.playing,false);assert.equal(r.controller.rankLabel.string,'第 1 名');assert.equal(r.controller.statusLabel.string,'已登顶');assert.equal(r.controller.paper.length,0);r.controller.onDestroy();reduced=false
const f=harness(750,1334,true);f.controller.renderState(true,12,16,5);f.ready();assert.equal(f.controller.buttons.length,3);f.controller.act({propagationStopped:false},1);stepButtons();assert.equal(f.calls[1],1);f.controller.onDestroy()
const held=harness();held.controller.renderState(true,5954,512,83);held.ready();held.controller.renderRank(result(1,1,{entries:[],celebrate:false}),false);held.controller.update(1);assert.equal(held.controller.rankNumber.string,'1');assert.equal(held.controller.rankNumber.node.parent.active,true);assert.equal(held.controller.rankNumber.node.parent.position.x,0);assert.equal(held.controller.deltaLabel.node.active,false);assert.equal(held.controller.rankLabel.node.active,false);assert.equal(held.controller.statusLabel.string,'已登顶');held.controller.onDestroy();
console.log('生命周期：加载前后、待同步、后台收敛、重开/返回/分享、减少动态、加载失败回退、释放通过')

// 统一结算卡的真实层级：标题只烘在底图，五行视口与长数字留白匹配。
const compact=harness();const view=compact.controller;view.renderState(true,1_000_000_000,2048,1_000_000);compact.ready();
assert.equal(view.scoreLabel.string,'1,000,000,000');assert.equal(view.highestLabel.string,'2048');assert.equal(view.coinsLabel.string,'+1,000,000');
assert.equal(view.panel.getChildByName('Title'),null);assert.equal(view.panel.getChildByName('TitleBounds').getComponent(Label),null);
assert.equal(view.panel.children[0].name,'Board');
assert.equal(view.scoreLabel.fontSize,76);assert.equal(view.scoreLabel.node.getComponent(UITransform).width,570);assert.equal(view.scoreLabel.overflow,2);assert.equal(view.scoreLabel.enableWrapText,false);
for(const name of ['Highest','Coins'])assert.equal(view.panel.getChildByPath('Statistics/'+name).getComponent(Graphics),null);
assert.equal(view.list.getComponent(UITransform).height,presentation.SETTLEMENT_LIST_HEIGHT);
const listTop=view.list.position.y+presentation.SETTLEMENT_LIST_HEIGHT/2;assert.equal(listTop,60);
view.renderRank(result(7,1),false);for(let i=0;i<390;i++)view.update(.016);
const shown=view.rows.filter(r=>r.node.active&&Math.abs(r.node.position.y)<presentation.SETTLEMENT_LIST_HEIGHT/2);assert.equal(shown.length,4);
assert.ok(view.selfRow.node.getComponent(UITransform).width*1.035<=view.list.getComponent(UITransform).width);
assert.equal(view.selfRow.node.position.y,presentation.SETTLEMENT_LIST_HEIGHT/2-presentation.SETTLEMENT_ROW_STEP/2);
const heading=view.panel.getChildByPath('Board/Heading');assert.ok(listTop<heading.position.y-heading.getComponent(UITransform).height/2);
view.onDestroy();
console.log('一体结算卡：标题烘图、七至十位千分位、奖励行、五行视口及登顶落位通过');

// 入场与冲榜共用更新时钟，但冲榜只能在卡片稳定之后推进。
const opening=harness(), oc=opening.controller;
opening.ready();assert.equal(oc.panel.active,false);
oc.renderState(true,1258880,2048,128);oc.renderRank(result(7,1),false);
assert.equal(oc.panelOpacity.opacity,0);assert.equal(oc.maskOpacity.opacity,0);
assert.ok(oc.panel.scale.x<oc.layoutScale);assert.ok(oc.panel.position.y<0);
const startY=oc.selfRow.node.position.y;oc.update(.1);
assert.ok(oc.panelOpacity.opacity>0&&oc.panelOpacity.opacity<255);
assert.ok(oc.maskOpacity.opacity>0&&oc.maskOpacity.opacity<255);
assert.equal(oc.elapsed,0);assert.equal(oc.selfRow.node.position.y,startY);
const movingY=oc.panel.position.y;oc.syncLayout();assert.equal(oc.panel.position.y,movingY);
oc.renderState(true,1258880,2048,128);assert.ok(oc.panelOpacity.opacity>0);
oc.update(.22);assert.equal(oc.entering,false);assert.equal(oc.elapsed,0);
assert.equal(oc.panelOpacity.opacity,255);assert.equal(oc.maskOpacity.opacity,255);
assert.equal(oc.panel.scale.x,oc.layoutScale);assert.equal(oc.panel.position.y,0);
oc.update(.18);assert.equal(oc.elapsed,180);oc.onDestroy();

// Prefab 慢于遮罩时，只对新卡片入场；不要再次把遮罩闪回透明。
const delayed=harness(), dc=delayed.controller;dc.renderState(true,3560,256,37);dc.update(.5);
assert.equal(dc.maskOpacity.opacity,255);delayed.ready();
assert.equal(dc.panelOpacity.opacity,0);assert.equal(dc.maskOpacity.opacity,255);
dc.renderRank(result(7,1),false);dc.update(.1);emit('hide');
assert.equal(dc.entering,false);assert.equal(dc.panelOpacity.opacity,255);assert.equal(dc.maskOpacity.opacity,255);
assert.equal(dc.panel.scale.x,dc.layoutScale);assert.equal(dc.playing,false);
emit('show');dc.update(.5);assert.equal(dc.entering,false);
dc.renderState(false,0,0,0);dc.onDisable();dc.onEnable();dc.renderState(true,6000,512,80);
assert.equal(dc.panelOpacity.opacity,0);assert.equal(dc.maskOpacity.opacity,0);dc.onDestroy();

const stopped=harness();stopped.controller.renderState(true,1,2,5);stopped.controller.onDisable();stopped.ready();
assert.equal(stopped.controller.entering,false);assert.equal(stopped.controller.panelOpacity.opacity,255);stopped.controller.onDestroy();
const closed=harness();closed.controller.renderState(true,1,2,5);closed.controller.renderState(false,0,0,0);closed.ready();
assert.equal(closed.controller.panel.active,false);assert.equal(closed.controller.entering,false);closed.controller.onDestroy();
reduced=true;const still=harness();still.controller.renderState(true,1,2,5);still.ready();
assert.equal(still.controller.entering,false);assert.equal(still.controller.panelOpacity.opacity,255);assert.equal(still.controller.maskOpacity.opacity,255);still.controller.onDestroy();reduced=false;
assert.equal([...eventBus.values()].flat().length,0);assert.equal(animations.length,0);
console.log('弹窗入场：渐显、重排连续、冲榜等待、慢加载不闪遮罩、后台与关闭清理、减少动态通过');

// 真机反馈：统计图标不能盖住标题，缩略图不能一直显示成绿色空块。
const maximum=harness(), mc=maximum.controller;mc.renderState(true,4172,512,68);maximum.ready();
const maximumGroup=mc.panel.getChildByPath('Statistics/Highest');
const caption=maximumGroup.getChildByName('Caption');
const icon=maximumGroup.getChildByName('Icon');
const value=maximumGroup.getChildByName('Label');
const size=n=>n.getComponent(UITransform);
assert.ok(caption.position.x-size(caption).width/2-(icon.position.x+size(icon).width/2)>=6);
assert.ok(value.position.x-size(value).width/2-(caption.position.x+size(caption).width/2)>=12);
assert.equal(caption.position.y,icon.position.y);assert.equal(caption.position.y,value.position.y);
assert.equal(mc.highestLabel.string,'512');assert.equal(mc.highestIconLabel.string,'512');
assert.equal(JSON.stringify(mc.highestIcon.color),JSON.stringify({r:110,g:85,b:184,a:255}));
mc.renderRank(result(1,1,{self:entry(1,true,13288),entries:[],celebrate:false}),false);
assert.equal(mc.highestLabel.string,'512');assert.equal(mc.highestIconLabel.string,'512');
for(const [value,hex]of [[2,'#f8ecdc'],[16,'#9bc849'],[512,'#6e55b8'],[1024,'#8f54ad'],[2048,'#cf586d'],[8192,'#2f6c78']]){
  mc.renderState(true,4172,value,68);
  assert.equal(mc.highestIconLabel.string,String(value));assert.equal(mc.highestLabel.string,String(value));
  const expected=cc.Color.fromHEX(new cc.Color(),hex);assert.equal(JSON.stringify(mc.highestIcon.color),JSON.stringify(expected));
}
assert.equal(JSON.stringify(mc.highestIconOutline.color),JSON.stringify(cc.Color.fromHEX(new cc.Color(),'#e8ad2d')));
mc.renderState(true,4172,0,68);assert.equal(mc.highestIcon.node.active,false);
mc.renderState(true,4172,512,68);assert.equal(mc.highestIcon.node.active,true);mc.onDestroy();

const pieceCc={...cc,_decorator:{...cc._decorator,property:()=>()=>{}},ParticleSystem2D:class{},Vec2:class{}};
const {PieceController}=load('assets/script/gameplay/PieceController.ts',{cc:pieceCc,'./PieceStyle':pieceStyles});
const piece=new PieceController();piece.node=new Node('ActualPiece');piece.bodySprite=new Node('Body').addComponent(Sprite);
piece.setValue(512);assert.equal(JSON.stringify(piece.bodySprite.color),JSON.stringify(cc.Color.fromHEX(new cc.Color(),'#6e55b8')));
const {ScoreManager}=load('assets/script/gameplay/ScoreManager.ts',{});const scoreManager=new ScoreManager();
for(const value of [128,512,256])scoreManager.updateHighestPieceValue(value);
assert.equal(scoreManager.getHighestPieceValue(),512);scoreManager.reset();assert.equal(scoreManager.getHighestPieceValue(),0);
scoreManager.restore(0,1024);scoreManager.updateHighestPieceValue(512);assert.equal(scoreManager.getHighestPieceValue(),1024);
console.log('最高合成：统计间距、512 紫色数字缩略图、共享棋盘配色、零值隐藏、本局最高记录与榜单分离通过');

// Cocos 切场景先停用，再销毁子节点，最后调用父节点组件的 onDestroy。
function destroySceneOverlay(controller) {
  controller.onDisable();
  const destroyChildrenFirst = node => {
    for(const child of node.children)destroyChildrenFirst(child);
    node.events=null;
    for(const component of node.components)component.isValid=false;
    node.isValid=false;
  };
  for(const child of controller.node.children)destroyChildrenFirst(child);
  controller.node.events=null;
  controller.onDestroy();
  controller.node.isValid=false;
}
for(const fallback of [false,true]){
  const home=harness(750,1334,fallback), controller=home.controller;
  controller.renderState(true,4172,512,68);home.ready();
  if(!fallback){controller.renderRank(result(7,1),false);controller.update(2.8);assert.ok(controller.paper.length);}
  const oldButtons=[...controller.buttons];
  controller.options.homeHandler=()=>{home.calls[0]++;destroySceneOverlay(controller)};
  controller.homeTap({propagationStopped:false});
  assert.doesNotThrow(()=>stepButtons());
  assert.deepEqual(home.calls,[1,0,0]);assert.equal(controller.disposed,true);
  assert.ok(oldButtons.every(button=>!button.isValid&&button.events===null));
  assert.equal([...eventBus.values()].flat().length,0);assert.equal(animations.length,0);
}
const leaving=harness();leaving.controller.renderState(true,4172,512,68);
assert.doesNotThrow(()=>destroySceneOverlay(leaving.controller));
leaving.ready();assert.equal(leaving.controller.panel,null);
const detached=harness();detached.ready();
const liveButtons=[...detached.controller.buttons];
assert.ok(liveButtons.every(button=>button.events.get(Node.EventType.TOUCH_END).length===1));
detached.controller.onDestroy();
assert.ok(liveButtons.every(button=>button.events.get(Node.EventType.TOUCH_END).length===0));
assert.equal([...eventBus.values()].flat().length,0);assert.equal(animations.length,0);
console.log('结算返回首页：子按钮先销毁时不访问事件处理器、彩纸中离场、回退界面与未完成加载清理通过');

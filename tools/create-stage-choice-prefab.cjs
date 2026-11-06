// 创建可在 Creator 中直接编辑的静态晋级弹窗；重复运行保留已有资源 UUID。
const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const root = path.resolve(__dirname, '..')
const folder = 'assets/resources/base/Stage'
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const save = (file, value) => fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + '\n')
fs.mkdirSync(path.join(root, folder), { recursive: true })
const metadata = (file, importer, extra = {}) => {
  if (fs.existsSync(path.join(root, file + '.meta'))) return JSON.parse(read(file + '.meta')).uuid
  const uuid = randomUUID()
  save(file + '.meta', { ver: importer === 'typescript' ? '4.0.24' : importer === 'prefab' ? '1.1.50' : '1.2.0', importer, imported: true, uuid, files: importer === 'prefab' ? ['.json'] : [], subMetas: {}, userData: {}, ...extra })
  return uuid
}
metadata(folder, 'directory')
for (const name of ['EndlessProgression', 'StageChoicePopupController']) metadata('assets/script/gameplay/' + name + '.ts', 'typescript')
const scriptUuid = JSON.parse(read('assets/script/gameplay/StageChoicePopupController.ts.meta')).uuid
const compressedUuid = uuid => {
  const hex = uuid.replace(/-/g, ''), chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = hex.slice(0, 5)
  for (let i = 5; i < 32; i += 3) { const value = parseInt(hex.slice(i, i + 3), 16); result += chars[value >> 6] + chars[value & 63] }
  return result
}
const frameUuids = {}
const imageTemplate = JSON.parse(read('assets/resources/base/images/Pieces/piece-outline.png.meta'))
for (const [name, width, height] of [['panel',720,1040],['diagonal',256,256],['wildcard',256,256],['shuffle',256,256],['card',640,180],['confirm',560,128]]) {
  const file = folder + '/' + name + '.png'
  if (!fs.existsSync(path.join(root, file + '.meta'))) {
    const uuid = randomUUID()
    const meta = JSON.parse(JSON.stringify(imageTemplate).replaceAll(imageTemplate.uuid, uuid).replaceAll('piece-outline', name))
    const data = meta.subMetas.f9941.userData
    Object.assign(data, { trimX: 0, trimY: 0, width, height, rawWidth: width, rawHeight: height, offsetX: 0, offsetY: 0, borderTop: 0, borderBottom: 0, borderLeft: 0, borderRight: 0 })
    data.vertices = { rawPosition: [-width/2,-height/2,0,width/2,-height/2,0,-width/2,height/2,0,width/2,height/2,0], indexes: [0,1,2,2,1,3], uv: [0,height,width,height,0,0,width,0], nuv: [0,1,1,1,0,0,1,0], minPos: [-width/2,-height/2,0], maxPos: [width/2,height/2,0] }
    save(file + '.meta', meta)
  }
  frameUuids[name] = JSON.parse(read(file + '.meta')).uuid + '@f9941'
}
const templates = JSON.parse(read('assets/resources/base/Settings/SettingsPopup.prefab'))
const clone = value => JSON.parse(JSON.stringify(value))
const ref = id => ({ __id__: id })
const color = (r,g,b,a=255) => ({ __type__: 'cc.Color', r,g,b,a })
const vec = (x,y,z=0) => ({ __type__: 'cc.Vec3', x,y,z })
const objects = [{ __type__: 'cc.Prefab', _name: 'StageChoicePopup', _objFlags: 0, __editorExtras__: {}, _native: '', data: ref(1), optimizationPolicy: 0, persistent: false }]
function component(node, type, data={}) {
  const index = objects.length
  objects.push({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(node), _enabled: true, __prefab: null, ...data, _id: '' })
  objects[node]._components.push(ref(index))
  return index
}
function node(name,parent,x,y,width,height,active=true) {
  const index = objects.length, value = clone(templates.find(x=>x.__type__==='cc.Node'))
  Object.assign(value, { _name: name, _parent: parent === null ? null : ref(parent), _children: [], _active: active, _components: [], _prefab: null, _lpos: vec(x,y), _lscale: vec(1,1,1), _id: randomUUID() })
  objects.push(value)
  if (parent !== null) objects[parent]._children.push(ref(index))
  component(index, 'cc.UITransform', { _contentSize: { __type__: 'cc.Size', width,height }, _anchorPoint: { __type__: 'cc.Vec2', x:.5,y:.5 } })
  return index
}
function sprite(owner, frame, tint=color(255,255,255)) {
  const value=clone(templates.find(x=>x.__type__==='cc.Sprite'))
  delete value.node; delete value.__prefab; delete value.__type__
  return component(owner,'cc.Sprite',{...value,_spriteFrame:{__uuid__:frame,__expectedType__:'cc.SpriteFrame'},_sizeMode:0,_isTrimmedMode:false,_color:tint})
}
const font = { __uuid__: JSON.parse(read('assets/fonts/EazyChatR.ttf.meta')).uuid, __expectedType__: 'cc.TTFFont' }
function label(name,parent,text,x,y,width,height,size,align=1,tint=color(98,57,31)) {
  const owner=node(name,parent,x,y,width,height), value=clone(templates.find(x=>x.__type__==='cc.Label'))
  delete value.node; delete value.__prefab; delete value.__type__
  const index=component(owner,'cc.Label',{...value,_string:text,_fontSize:size,_actualFontSize:size,_lineHeight:size+5,_horizontalAlign:align,_font:font,_isSystemFontUsed:false,_color:tint,_isBold:false,_overflow:2})
  return {node:owner,component:index}
}
const rootNode=node('StageChoicePopup',null,0,0,750,1334,false)
component(rootNode,'cc.BlockInputEvents')
const mask=node('Mask',rootNode,0,0,750,1334)
component(mask,'cc.Graphics',{_lineWidth:1,_strokeColor:color(0,0,0),_fillColor:color(25,21,15),_lineJoin:0,_lineCap:0,_miterLimit:10})
const maskOpacity=component(mask,'cc.UIOpacity',{_opacity:0})
const panel=node('Panel',rootNode,0,0,680,970)
sprite(panel,frameUuids.panel)
const panelOpacity=component(panel,'cc.UIOpacity',{_opacity:255})
label('Title',panel,'进入第二阶段',0,330,600,76,52)
const hint=label('Hint',panel,'选择一项效果，继续挑战',0,268,600,44,25)
const cards=[],selections=[]
const names=['斜向合并','万能来客','打乱'],icons=['diagonal','wildcard','shuffle']
const descriptions=['斜着相邻，也能合并','定期出现万能数字\n落地复制下方数字','重新排列场上数字\n寻找新的合并机会']
for(let i=0;i<3;i++) {
  const card=node(icons[i]+'Card',panel,0,146-i*166,600,150)
  component(card,'cc.UIOpacity',{_opacity:255});sprite(card,frameUuids.card)
  const selected=node('Selected',card,0,0,600,150,false)
  sprite(selected,frameUuids.card,color(208,238,169))
  const check=label('Check',selected,'✓',279,60,44,44,35,1,color(42,112,30))
  objects[check.component]._font=null;objects[check.component]._isSystemFontUsed=true;objects[check.component]._fontFamily='Arial'
  const icon=node('Icon',card,-226,0,100,100);sprite(icon,frameUuids[icons[i]])
  label('Name',card,names[i],12,33,280,50,38,0)
  label('Description',card,descriptions[i],58,-28,372,64,26,0)
  const badge=node('TypeBadge',card,211,42,128,38)
  sprite(badge,frameUuids.card,i===2?color(255,207,85):color(210,232,163))
  label('Type',badge,i===2?'立即一次':'本局持续',0,0,118,34,20)
  cards.push(ref(card));selections.push(ref(selected))
}
const confirm=node('Confirm',panel,0,-360,520,110)
sprite(confirm,frameUuids.confirm);component(confirm,'cc.UIOpacity',{_opacity:130})
label('Label',confirm,'确认选择',0,3,460,80,42)
component(rootNode,compressedUuid(scriptUuid),{panel:ref(panel),maskOpacity:ref(maskOpacity),panelOpacity:ref(panelOpacity),cards,selections,confirmNode:ref(confirm),hint:ref(hint.component)})
const serializedObjects=objects.slice()
for(let i=1;i<serializedObjects.length;i++) {
  const value=objects[i], info=objects.length
  if(value.__type__==='cc.Node') {value._prefab=ref(info);objects.push({__type__:'cc.PrefabInfo',root:ref(rootNode),asset:ref(0),fileId:'stage-node-'+i,instance:null,targetOverrides:null,nestedPrefabInstanceRoots:null})}
  else {value.__prefab=ref(info);objects.push({__type__:'cc.CompPrefabInfo',fileId:'stage-component-'+i})}
}
save(folder+'/StageChoicePopup.prefab',objects)
metadata(folder+'/StageChoicePopup.prefab','prefab',{userData:{syncNodeName:'StageChoicePopup'}})

// 在现有 HUD 中仅追加一个静态文字节点，不重写旧节点或用户正在修改的其他场景。
const sceneFile=path.join(root,'assets/scence/game.scene')
let raw=fs.readFileSync(sceneFile,'utf8').replace(/\r\n/g,'\n'),scene=JSON.parse(raw)
if(!scene.some(x=>x.__type__==='cc.Node'&&x._name==='StageStatus')) {
  const status=scene.find(x=>x.__type__==='cc.Node'&&x._name==='Status')
  const parent=status._children[0].__id__, start=scene.length
  const item=clone(objects[hint.node]);Object.assign(item,{_name:'StageStatus',_parent:ref(parent),_children:[],_components:[ref(start+1),ref(start+2)],_prefab:null,_lpos:vec(0,600),_id:randomUUID()})
  const transform=clone(objects[objects[hint.node]._components[0].__id__]);Object.assign(transform,{node:ref(start),__prefab:null,_contentSize:{__type__:'cc.Size',width:420,height:42}})
  const text=clone(objects[hint.component]);Object.assign(text,{node:ref(start),__prefab:null,_string:'合出 1024 · 解锁成长',_fontSize:23,_actualFontSize:23,_lineHeight:28,_enableOutline:true,_outlineColor:color(255,249,237),_outlineWidth:2})
  const nameIndex=raw.indexOf('"_name": "Content"'), childrenEnd=raw.indexOf('\n    ],',nameIndex)
  if(nameIndex<0||childrenEnd<0)throw new Error('未找到场景 HUD 容器')
  raw=raw.slice(0,childrenEnd)+',\n      {\n        "__id__": '+start+'\n      }'+raw.slice(childrenEnd)
  raw=raw.trimEnd().slice(0,-1).trimEnd()+',\n'+[item,transform,text].map(x=>JSON.stringify(x,null,2).split('\n').map(line=>'  '+line).join('\n')).join(',\n')+'\n]\n'
  fs.writeFileSync(sceneFile,raw.replace(/\n/g,'\r\n'))
}
console.log('StageChoicePopup.prefab、资源元数据和静态阶段 HUD 已生成')

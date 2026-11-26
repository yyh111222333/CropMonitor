import type {Ridge, RuleSettings, CollectionImage} from './contracts'

export type IndicatorKey = 'colorMatch' | 'fruitDiameter' | 'leafArea' | 'plantWidth'
export interface MaturityCriterion {key:IndicatorKey; enabled:boolean; target:number; weight:number}
export interface MaturityProfile {kind:'fruit'|'leafy'; colorDescription:string; readyScore:number; criteria:MaturityCriterion[]}
export interface MonitoringValues {colorMatch:number|null; fruitDiameter:number|null; plantWidth:number|null; leafGrowth:number|null}
export interface MonitorPoint {label:string; periodStart:string; periodEnd:string; value:number|null; sampleCount:number}
export interface MetricTrend {basis?:'size';key:string; label:string; unit:string; points:MonitorPoint[]}
export interface MonitoringTrend {series:MetricTrend[]; sampling:'day'|'week'}
export interface TreatmentRecord {id:string; farmId:string; fieldId:string; ridgeId:string; batch:string; plantedAt:string; sampledAt:string; createdAt:string; description:string; action:string; status:'处理中'|'待复查'|'已完成'; photos:CollectionImage[]; issues:string[]}
export interface AnomalyDetail {ridgeId:string; batch:string; plantedAt:string; sampledAt:string; description:string; issues:string[]; photos:CollectionImage[]; records:TreatmentRecord[]}
export interface TreatmentInput {batch:string; plantedAt:string; sampledAt:string; description:string; action:string; status:TreatmentRecord['status']}
export const indicatorInfo:Record<IndicatorKey,{label:string;unit:string}>={colorMatch:{label:'目标色泽达标比例',unit:'%'},fruitDiameter:{label:'平均果径',unit:'cm'},leafArea:{label:'平均叶片面积',unit:'cm²'},plantWidth:{label:'平均植株宽度',unit:'cm'}}
export function defaultMaturityProfile(cropId:string,kind:'fruit'|'leafy'=cropId==='chive'?'leafy':'fruit'):MaturityProfile {
 return {kind,colorDescription:kind==='leafy'?'叶色均匀、达到品种采收色泽':'果面达到品种采收色泽（红色）',readyScore:85,criteria:[{key:'colorMatch',enabled:true,target:80,weight:50},{key:'fruitDiameter',enabled:kind==='fruit',target:cropId==='strawberry'?3:5,weight:50},{key:'leafArea',enabled:kind==='leafy',target:35,weight:30},{key:'plantWidth',enabled:kind==='leafy',target:25,weight:20}]}
}
export function validateMaturityProfile(value:unknown):string|null {
 if(!value||typeof value!=='object')return '成熟指标格式不正确'
 const p=value as MaturityProfile
 if(p.kind!=='fruit'&&p.kind!=='leafy')return '请选择果菜类或叶菜类'
 if(typeof p.colorDescription!=='string'||!p.colorDescription.trim()||p.colorDescription.length>120)return '请填写 1～120 字的目标色泽描述'
 if(!Number.isFinite(p.readyScore)||p.readyScore<1||p.readyScore>100)return '综合提醒分值须为 1～100'
 if(!Array.isArray(p.criteria)||p.criteria.length!==4||new Set(p.criteria.map(c=>c?.key)).size!==4)return '请提供完整且不重复的成熟指标'
 for(const c of p.criteria){
  if(!c||!Object.hasOwn(indicatorInfo,c.key)||typeof c.enabled!=='boolean'||!Number.isFinite(c.target)||c.target<=0||c.target>(c.key==='colorMatch'?100:10000)||!Number.isFinite(c.weight)||c.weight<=0||c.weight>100)return '指标目标值和权重必须为有效正数，比例与权重不超过 100'
  if(c.enabled&&((p.kind==='leafy'&&c.key==='fruitDiameter')||(p.kind==='fruit'&&['leafArea','plantWidth'].includes(c.key))))return '启用的指标与作物类型不匹配'
 }
 if(p.criteria.filter(c=>c.enabled).length<2)return '综合评价至少启用两个指标'
 if(!p.criteria.some(c=>c.key==='colorMatch'&&c.enabled))return '请启用目标色泽指标'
 return null
}
export function assessHarvest(r:Ridge,rules:RuleSettings,profile:MaturityProfile,now=Date.now()) {
 const age=(now-Date.parse(r.sampledAt))/86400000
 const fresh=Number.isFinite(age)&&age>=0&&age<rules.staleDays
 const usable=r.active&&r.quality==='可用'&&fresh
 const factors=profile.criteria.filter(c=>c.enabled).map(c=>{
  const value=c.key==='leafArea'?r.leafArea:r.monitoring?.[c.key]??null
  const enough=c.key==='leafArea'||(c.key==='colorMatch'&&profile.kind==='leafy')?r.leafSampleCount>=rules.minLeafSamples:c.key==='plantWidth'?r.plantSampleCount>=rules.minPlantSamples:r.fruitCount>=rules.minFruitSamples
  const valid=usable&&enough&&value!==null&&Number.isFinite(value)&&value>=0&&(c.key!=='colorMatch'||value<=100)
  return {...c,...indicatorInfo[c.key],value:valid?value:null,attainment:valid?Math.min(100,value!/c.target*100):null}
 })
 const complete=factors.length>=2&&factors.every(f=>f.attainment!==null)
 const weight=factors.reduce((n,f)=>n+f.weight,0)
 const score=complete?Number((factors.reduce((n,f)=>n+f.attainment!*f.weight,0)/weight).toFixed(1)):null
 const ready=score!==null&&score>=profile.readyScore
 const reason=!r.active?'未种植':!usable?'等待有效巡检':!complete?'必要指标缺失或样本不足':''
 return {score,ready,factors,reason,label:score===null?'待检测':ready?'达到采收参考':score>=profile.readyScore*.8?'接近采收':'继续观察'}
}

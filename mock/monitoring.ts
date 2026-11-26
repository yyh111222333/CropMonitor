import {dimensionValues} from '../shared/growthDimensions'
import {aggregateGrowthTrend} from './growthTrend'
import type {Ridge, CollectionImage} from '../shared/contracts'
import type {MetricTrend, MonitoringTrend, MonitoringValues, AnomalyDetail} from '../shared/monitoring'
import {defaultMaturityProfile} from '../shared/monitoring'
import {effectiveRules,evaluateRidge} from '../shared/rules'
import type {Database,FieldDatabase} from './db'

export interface MonitorObservation extends MonitoringValues {ridgeId:string;cropId:string;batch:string;plantedAt:string;date:string;previousDate:string|null;leafArea:number;fruitCount:number;plantSamples:number;leafSamples:number}
const day=86400000
export function seedMonitoring(ridges:Ridge[]):MonitorObservation[]{
 const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10)
 return ridges.filter(r=>r.active).flatMap(r=>{
  r.monitoring={colorMatch:r.cropId==='chive'?72+r.number%5*4:Number((r.mature/r.fruitCount*100).toFixed(1)),fruitDiameter:r.cropId==='chive'?null:Number(((r.cropId==='tomato'?3.5:2)+r.number%7*.28).toFixed(2)),plantWidth:20+r.number%9,leafGrowth:Number((.12+r.number%6*.015).toFixed(2))}
  const growth=(ago:number)=>Number((r.monitoring!.leafGrowth!*(1+.18*Math.sin(ago*.5+r.number)-.18*Math.sin(r.number))).toFixed(2))
  return Array.from({length:57},(_,i)=>{
   const ago=56-i,date=new Date(Date.parse(today)-ago*day).toISOString().slice(0,10)
   return {ridgeId:r.id,cropId:r.cropId,batch:r.batch,plantedAt:r.plantedAt,date,previousDate:i?new Date(Date.parse(date)-day).toISOString().slice(0,10):null,leafGrowth:i?growth(ago):null,leafArea:Number((r.leafArea-Array.from({length:ago},(_,j)=>growth(j)).reduce((n,v)=>n+v,0)).toFixed(2)),colorMatch:Number(Math.max(0,r.monitoring!.colorMatch!-ago*.7).toFixed(1)),fruitDiameter:r.monitoring!.fruitDiameter===null?null:Number(Math.max(.2,r.monitoring!.fruitDiameter!-ago*.035).toFixed(2)),plantWidth:Number(Math.max(2,r.monitoring!.plantWidth!-ago*.08).toFixed(2)),fruitCount:Math.max(0,r.fruitCount-Math.floor(ago*.4)),plantSamples:r.plantSampleCount,leafSamples:r.leafSampleCount}
  }).filter(o=>o.date>=r.plantedAt)
 })
}
export function aggregateMonitoring(db:FieldDatabase,cropId:string|null,granularity:'week'|'month',now=Date.now(),dimensions=false):MonitoringTrend {
 const sampling=granularity==='week'?'day':'week'
 if(!cropId)return {sampling,series:[]}
 const profile=db.crops.find(c=>c.id===cropId)?.maturityProfile??defaultMaturityProfile(cropId)
 const specs:{key:keyof MonitorObservation;label:string;unit:string;sample:'plantSamples'|'leafSamples'|'fruitCount';minimum:number;relative?:boolean}[]=[{key:'leafGrowth',label:dimensions?'叶片长势':'叶片面积增长幅度',unit:'cm²',sample:'leafSamples',minimum:db.settings.minLeafSamples,relative:true},...(profile.kind==='fruit'?[{key:'fruitDiameter' as const,label:'平均果径',unit:'cm',sample:'fruitCount' as const,minimum:0},{key:'fruitCount' as const,label:'可见果实数量',unit:'个',sample:'fruitCount' as const,minimum:0}]:[{key:'leafArea' as const,label:'平均叶片面积',unit:'cm²',sample:'leafSamples' as const,minimum:0},{key:'plantWidth' as const,label:'平均植株宽度',unit:'cm',sample:'plantSamples' as const,minimum:0}]),{key:'colorMatch',label:profile.kind==='fruit'?'果实目标色泽达标比例':'叶色达标比例',unit:'%',sample:profile.kind==='fruit'?'fruitCount':'leafSamples',minimum:0}]
 const rules=effectiveRules(db.settings,cropId)
 specs.forEach(s=>s.minimum=s.sample==='leafSamples'?rules.minLeafSamples:s.sample==='fruitCount'?rules.minFruitSamples:rules.minPlantSamples)
 const current=new Map(db.ridges.filter(r=>r.active&&r.cropId===cropId).map(r=>[r.id,r]))
 const today=new Date(new Date(now+8*3600000).toISOString().slice(0,10)+'T00:00:00Z'),start=new Date(today)
 if(granularity==='week')start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7-35)
 else {start.setUTCDate(1);start.setUTCMonth(start.getUTCMonth()-5)}
 const key=(d:Date)=>d.toISOString().slice(0,10)
 const leafTotals=dimensions?dimensionValues(db.monitorObservations,o=>o.leafGrowth,o=>o.previousDate===null?o.leafArea:null,o=>o.leafSamples>=rules.minLeafSamples&&Number.isFinite(o.leafSamples)):null
 const source=dimensions?db.monitorObservations.map(o=>({...o,leafGrowth:leafTotals!.get(o)??null})):db.monitorObservations
 const rows=source.filter(o=>{const r=current.get(o.ridgeId);return r&&o.cropId===cropId&&o.batch===r.batch&&o.plantedAt===r.plantedAt&&o.date>=r.plantedAt&&o.date>=key(start)&&o.date<=key(today)})
 const growthPeriods=aggregateGrowthTrend(db,cropId,granularity,now,true,dimensions).points
 const fallbackPeriods=[]
 if(rows.length){
  const first=new Date(rows.map(o=>o.date).sort()[0]!+'T00:00:00Z')
  if(sampling==='week')first.setUTCDate(first.getUTCDate()-(first.getUTCDay()+6)%7)
  for(let time=first.getTime();time<=today.getTime();time+=(sampling==='day'?1:7)*day)fallbackPeriods.push({periodStart:key(new Date(Math.max(start.getTime(),time))),periodEnd:key(new Date(Math.min(today.getTime(),time+(sampling==='day'?0:6)*day)))})
 }
 const periods=growthPeriods.length?growthPeriods:fallbackPeriods
 const series:MetricTrend[]=specs.map(s=>{
  const points=[]
  for(const {periodStart,periodEnd} of periods){
   let selected=rows.filter(o=>o.date>=periodStart&&o.date<=periodEnd&&Number.isFinite(o[s.sample])&&o[s.sample]>=s.minimum&&o[s.key]!==null&&Number.isFinite(o[s.key])&&(!s.relative||dimensions||(o.previousDate!==null&&o.previousDate>=o.plantedAt&&o.previousDate<o.date)))
   if(dimensions&&s.relative&&selected.length){const lastDate=selected.map(o=>o.date).sort().at(-1)!;selected=selected.filter(o=>o.date===lastDate)}
   const count=selected.reduce((n,o)=>n+o[s.sample],0)
   // Fruit quantity is a daily total; weekly values average daily totals, never add repeated counts across days.
   const dates=new Set(selected.map(o=>o.date)).size
   const value=count?(s.key==='fruitCount'?selected.reduce((n,o)=>n+o.fruitCount,0)/dates:selected.reduce((n,o)=>n+(o[s.key] as number)*o[s.sample],0)/count):null
   points.push({label:periodStart.slice(5).replace('-','/'),periodStart,periodEnd,sampleCount:count,value:value===null?null:Number(value.toFixed(2))})
  }
  return {key:s.key,label:s.label,unit:s.unit,points,...(dimensions&&s.relative?{basis:'size' as const}:{})}
 })
 return {sampling,series}
}
export function inspectionPhotos(r:Ridge):CollectionImage[]{
 if(!r.active||r.quality!=='可用'||!['tomato','strawberry'].includes(r.cropId))return []
 return [{id:r.id+'-'+r.sampledAt,url:'/api/media/'+r.cropId+'-'+(r.lesions?'diseased':'healthy')+'-clean.png',title:'本次巡检关联照片（模拟）',capturedAt:r.sampledAt}]
}
export function anomalyDetail(db:FieldDatabase,database:Database,r:Ridge,farmId:string,fieldId:string):AnomalyDetail {
 const e=evaluateRidge(r,effectiveRules(db.settings,r.cropId),Date.now(),db.crops.find(c=>c.id===r.cropId)?.maturityProfile)
 const description=e.issues.length?`${r.number}号垄：${e.issues.join('、')}。较上次增长 ${r.growthCm??'待对比'} cm；病叶 ${r.diseasedLeafCount}/${r.leafSampleCount} 片${db.crops.find(c=>c.id===r.cropId)?.maturityProfile?.kind==='leafy'?'。':`；病果 ${r.diseasedFruitCount}/${r.fruitCount} 个。`}`:'当前没有规则触发的异常，可记录人工巡检发现。'
 return {ridgeId:r.id,batch:r.batch,plantedAt:r.plantedAt,sampledAt:r.sampledAt,description,issues:e.issues,photos:inspectionPhotos(r),records:database.treatmentRecords.filter(t=>t.farmId===farmId&&t.fieldId===fieldId&&t.ridgeId===r.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
}

import {dimensionValues} from '../shared/growthDimensions'
import type {GrowthObservation,GrowthTrend,TrendGranularity,Ridge} from '../shared/contracts'
import type {FieldDatabase} from './db'
import {effectiveRules} from '../shared/rules'
const day=86400000
const dateKey=(date:Date)=>date.toISOString().slice(0,10)
export function createGrowthObservations(ridges:Ridge[],now=Date.now()):GrowthObservation[]{
 const today=new Date(new Date(now+8*3600000).toISOString().slice(0,10)+'T00:00:00Z')
 return ridges.filter(r=>r.active).flatMap(r=>Array.from({length:57},(_,i)=>{
  const ago=56-i,date=new Date(today.getTime()-ago*day)
  return {ridgeId:r.id,cropId:r.cropId,batch:r.batch,plantedAt:r.plantedAt,date:dateKey(date),initialSizeCm:i===0?Number(((r.cropId==='tomato'?18:r.cropId==='strawberry'?6:8)+r.number*.4).toFixed(2)):null,previousDate:i===0?null:dateKey(new Date(date.getTime()-day)),growthCm:i===0?null:Number(((r.growthCm??0)*(1+0.16*Math.sin(ago*0.7+r.number)-0.16*Math.sin(r.number))).toFixed(2)),plantSamples:r.plantSampleCount}
 }).filter(o=>o.date>=r.plantedAt))
}
export function aggregateGrowthTrend(db:FieldDatabase,cropId:string|null,granularity:TrendGranularity,now=Date.now(),detail=false,dimensions=false):GrowthTrend{
 const result:GrowthTrend={cropId:cropId||'',granularity,sampling:detail?(granularity==='week'?'day':'week'):granularity,unit:'cm',...(dimensions?{basis:'size' as const}:{}),points:[]}
 if(!cropId)return result
 const today=new Date(new Date(now+8*3600000).toISOString().slice(0,10)+'T00:00:00Z')
 const anchor=new Date(today)
 if(granularity==='week')anchor.setUTCDate(anchor.getUTCDate()-(anchor.getUTCDay()+6)%7)
 else anchor.setUTCDate(1)
 const current=new Map(db.ridges.filter(r=>r.active&&r.cropId===cropId).map(r=>[r.id,r]))
 const minSamples=effectiveRules(db.settings,cropId).minPlantSamples
 const totals=dimensions?dimensionValues(db.growthObservations,o=>o.growthCm,o=>o.initialSizeCm??null,o=>o.plantSamples>=minSamples&&Number.isFinite(o.plantSamples)):null
 const source=dimensions?db.growthObservations.map(o=>({...o,growthCm:totals!.get(o)??null})):db.growthObservations
 const observations=source.filter(o=>{
  const r=current.get(o.ridgeId)
  return r&&o.cropId===cropId&&o.batch===r.batch&&o.plantedAt===r.plantedAt&&o.date>=r.plantedAt&&o.plantSamples>=minSamples&&Number.isFinite(o.plantSamples)&&o.growthCm!==null&&Number.isFinite(o.growthCm)&&(dimensions||(o.previousDate!==null&&o.previousDate>=r.plantedAt&&o.previousDate<o.date))
 })
 const summarize=(rows:GrowthObservation[])=>{
  if(dimensions&&rows.length){const lastDate=rows.map(o=>o.date).sort().at(-1)!;rows=rows.filter(o=>o.date===lastDate)}
  const sampleCount=rows.reduce((n,o)=>n+o.plantSamples,0)
  return {sampleCount,value:sampleCount?Number((rows.reduce((n,o)=>n+o.growthCm!*o.plantSamples,0)/sampleCount).toFixed(2)):null}
 }
 result.points=Array.from({length:6},(_,i)=>{
  const start=new Date(anchor),end=new Date(anchor)
  if(granularity==='week'){start.setUTCDate(start.getUTCDate()-(5-i)*7);end.setTime(start.getTime()+6*day)}
  else {start.setUTCMonth(start.getUTCMonth()-(5-i));end.setTime(start.getTime());end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0)}
  const periodStart=dateKey(start),periodEnd=dateKey(new Date(Math.min(end.getTime(),today.getTime())))
  const rows=observations.filter(o=>o.date>=periodStart&&o.date<=periodEnd)
  return {label:granularity==='week'?periodStart.slice(5).replace('-','/')+' 起':periodStart.slice(0,7),periodStart,periodEnd,...summarize(rows)}
 })
 if(detail){
  const rangeStart=new Date(result.points[0]!.periodStart+'T00:00:00Z')
  const available=observations.filter(o=>o.date>=dateKey(rangeStart)&&o.date<=dateKey(today)).sort((a,b)=>a.date.localeCompare(b.date))
  result.points=[]
  if(!available.length)return result
  const cursor=new Date(available[0]!.date+'T00:00:00Z')
  if(result.sampling==='week')cursor.setUTCDate(cursor.getUTCDate()-(cursor.getUTCDay()+6)%7)
  while(cursor<=today){
   const start=new Date(Math.max(cursor.getTime(),rangeStart.getTime()))
   const end=new Date(Math.min(cursor.getTime()+(result.sampling==='week'?6:0)*day,today.getTime()))
   const periodStart=dateKey(start),periodEnd=dateKey(end)
   const rows=available.filter(o=>o.date>=periodStart&&o.date<=periodEnd)
   result.points.push({label:periodStart.slice(5).replace('-','/'),periodStart,periodEnd,...summarize(rows)})
   cursor.setUTCDate(cursor.getUTCDate()+(result.sampling==='week'?7:1))
  }
 }
 return result
}

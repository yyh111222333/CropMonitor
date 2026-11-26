import type {CropSummary} from '../shared/contracts'
import {effectiveRules,evaluateRidge} from '../shared/rules'
import type {FieldDatabase} from './db'

export function summarizeCrops(db:FieldDatabase,now=Date.now()):CropSummary[]{
 return db.crops.map(c=>{
  const rows=db.ridges.filter(r=>r.active&&r.cropId===c.id),rules=effectiveRules(db.settings,c.id)
  const evaluated=rows.map(r=>({r,e:evaluateRidge(r,rules,now,c.maturityProfile)}))
  const growth=evaluated.filter(({r,e})=>e.usable&&e.comparable&&r.plantSampleCount>=rules.minPlantSamples)
  const fruits=evaluated.filter(({e})=>e.maturity!==null)
  const samples=growth.reduce((n,{r})=>n+r.plantSampleCount,0)
  const average=()=>samples?Number((growth.reduce((n,{r})=>n+r.growthCm!*r.plantSampleCount,0)/samples).toFixed(1)):null
  const dates=rows.filter(r=>r.quality!=='待首次巡检'&&Number.isFinite(Date.parse(r.sampledAt))).map(r=>r.sampledAt).sort()
  return {cropId:c.id,activeRidges:rows.length,plants:rows.reduce((n,r)=>n+r.plants,0),batches:new Set(rows.map(r=>r.batch)).size,averageGrowth:average(),attentionRidges:evaluated.filter(({e})=>e.issues.length).length,harvestReadyRidges:evaluated.filter(({e})=>e.harvestReady).length,validFruitCount:fruits.reduce((n,{r})=>n+r.fruitCount,0),matureFruitCount:fruits.reduce((n,{r})=>n+r.mature,0),totalHarvestKg:Math.round(db.harvests.filter(h=>h.cropId===c.id).reduce((n,h)=>n+h.quantity,0)*100)/100,latestInspectionAt:dates.at(-1)??null}
 })
}

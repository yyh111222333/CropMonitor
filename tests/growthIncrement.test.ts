import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createDatabase,defaultSettings} from '../mock/db'
import {aggregateGrowthTrend} from '../mock/growthTrend'
import {summarizeCrops} from '../mock/cropSummary'
import {evaluateRidge} from '../shared/rules'

test('trend averages measured increments, preserving zero and negative changes and excluding missing baselines',()=>{
 const db=createDatabase(),now=Date.parse('2027-01-15T04:00:00Z'),r=db.ridges[0]!
 r.plantedAt='2026-12-01';r.batch='current';db.ridges[1]!.cropId='tomato'
 const base={ridgeId:r.id,cropId:r.cropId,batch:r.batch,plantedAt:r.plantedAt,date:'2027-01-14',previousDate:'2027-01-13',plantSamples:10}
 db.growthObservations=[{...base,growthCm:2},{...base,ridgeId:db.ridges[1]!.id,batch:db.ridges[1]!.batch,plantedAt:db.ridges[1]!.plantedAt,growthCm:4,plantSamples:30},{...base,date:'2027-01-12',growthCm:100,previousDate:null},{...base,date:'2027-01-13',growthCm:100,previousDate:'2027-01-13'},{...base,date:'2027-01-15',growthCm:0},{...base,date:'2027-01-11',previousDate:'2027-01-10',growthCm:-0.4},{...base,growthCm:NaN},{...base,growthCm:null}]
 const trend=aggregateGrowthTrend(db,'tomato','week',now,true)
 assert.equal(trend.points.find(p=>p.periodStart==='2027-01-14')!.value,3.5)
 assert.equal(trend.points.find(p=>p.periodStart==='2027-01-15')!.value,0)
 assert.equal(trend.points.find(p=>p.periodStart==='2027-01-11')!.value,-0.4)
 assert.equal(trend.points.find(p=>p.periodStart==='2027-01-12')!.value,null)
 assert.equal(trend.points.find(p=>p.periodStart==='2027-01-13')!.value,null)
})

test('first detection cannot produce a growth assessment or crop growth summary',()=>{
 const db=createDatabase(),now=Date.now()
 for(const r of db.ridges){r.previousSampledAt=null;r.growthCm=null}
 const r=db.ridges[0]!,assessment=evaluateRidge(r,defaultSettings(),now)
 assert.equal(assessment.comparable,false)
 assert.ok(!assessment.issues.some(i=>i.startsWith('长势')))
 assert.equal(summarizeCrops(db,now)[0]!.averageGrowth,null)
 r.previousSampledAt=new Date(now-86400000).toISOString();r.growthCm=0
 assert.ok(evaluateRidge(r,defaultSettings(),now).issues.includes('长势偏慢'))
})

test('seed records retain increments and a measured starting size for reconstruction',()=>{
 const db=createDatabase()
 assert.ok(db.growthObservations.some(o=>o.growthCm===null&&o.previousDate===null))
 for(const r of db.ridges.filter(r=>r.active)){
  assert.ok(!('height' in r))
  assert.equal(db.growthObservations.filter(o=>o.ridgeId===r.id).at(-1)!.growthCm,r.growthCm)
 }
 assert.ok(db.growthObservations.every(o=>!('height' in o)))
})

import {test} from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import type {AddressInfo} from 'node:net'
import {dimensionValues} from '../shared/growthDimensions'
import {createDatabase} from '../mock/db'
import {aggregateGrowthTrend} from '../mock/growthTrend'
import {aggregateMonitoring} from '../mock/monitoring'
import {createMockServer} from '../mock/app'

test('dimension reconstruction requires a measured baseline and follows links across gaps and batches',()=>{
 const base={ridgeId:'a',cropId:'tomato',batch:'A',plantedAt:'2026-11-01'}
 const rows=[
  {...base,date:'2026-11-01',previousDate:null,initial:10,increment:null},
  {...base,date:'2026-11-02',previousDate:'2026-11-01',initial:null,increment:2},
  {...base,date:'2026-11-03',previousDate:'2026-11-02',initial:null,increment:-.5},
  {...base,date:'2026-11-04',previousDate:'2026-11-03',initial:null,increment:null},
  {...base,date:'2026-11-05',previousDate:'2026-11-04',initial:null,increment:1},
  {...base,date:'2026-11-06',previousDate:'2026-11-03',initial:null,increment:3},
  {...base,batch:'B',date:'2026-11-07',previousDate:'2026-11-06',initial:null,increment:2}
 ]
 const sizes=dimensionValues(rows,r=>r.increment,r=>r.initial,()=>true)
 assert.deepEqual(rows.map(r=>sizes.get(r)),[10,12,11.5,null,null,14.5,null])
 const withoutBaseline=dimensionValues(rows,r=>r.increment,()=>null,()=>true)
 assert.ok([...withoutBaseline.values()].every(v=>v===null))
})

test('daily and weekly size curves retain the same measured origin and latest dimensions',()=>{
 const db=createDatabase(),now=Date.now()
 for(const cropId of ['tomato','strawberry','chive']){
  const daily=aggregateGrowthTrend(db,cropId,'week',now,true,true)
  const weekly=aggregateGrowthTrend(db,cropId,'month',now,true,true)
  assert.equal(daily.basis,'size')
  assert.equal(daily.points.at(-1)!.value,weekly.points.at(-1)!.value)
  const ridges=db.ridges.filter(r=>r.active&&r.cropId===cropId)
  const expected=ridges.reduce((sum,r)=>{
   const rows=db.growthObservations.filter(o=>o.ridgeId===r.id)
   return sum+(rows[0]!.initialSizeCm!+rows.reduce((n,o)=>n+(o.growthCm??0),0))*r.plantSampleCount
  },0)/ridges.reduce((sum,r)=>sum+r.plantSampleCount,0)
  assert.ok(Math.abs(daily.points.at(-1)!.value!-expected)<=.00500001)
  const a=aggregateMonitoring(db,cropId,'week',now,true).series.find(s=>s.key==='leafGrowth')!
  const b=aggregateMonitoring(db,cropId,'month',now,true).series.find(s=>s.key==='leafGrowth')!
  assert.equal(a.basis,'size');assert.equal(a.points.at(-1)!.value,b.points.at(-1)!.value)
  const leafArea=ridges.reduce((n,r)=>n+r.leafArea*r.leafSampleCount,0)/ridges.reduce((n,r)=>n+r.leafSampleCount,0)
  assert.equal(a.points.at(-1)!.value,Number(leafArea.toFixed(2)))
 }
})

test('size endpoints return dimensions and keep interval mode backward compatible',async()=>{
 const db=createDatabase(),server=createMockServer(db,0);server.listen(0,'127.0.0.1');await once(server,'listening')
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api'
 try{
  for(const granularity of ['week','month']){
   const growth=await(await fetch(base+'/growth-trend?cropId=tomato&detail=true&mode=size&granularity='+granularity)).json()
   assert.equal(growth.data.basis,'size');assert.ok(growth.data.points.at(-1).value>10)
   const monitoring=await(await fetch(base+'/monitoring-trend?cropId=tomato&mode=size&granularity='+granularity)).json()
   const leaf=monitoring.data.series.find((s:any)=>s.key==='leafGrowth')
   assert.equal(leaf.basis,'size');assert.ok(leaf.points.at(-1).value>10)
  }
  assert.equal((await fetch(base+'/growth-trend?mode=unknown')).status,400)
  assert.equal((await fetch(base+'/monitoring-trend?mode=unknown')).status,400)
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))}
})

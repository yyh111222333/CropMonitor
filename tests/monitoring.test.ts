import {test} from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import type {AddressInfo} from 'node:net'
import {mkdtempSync,rmSync,rmdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createDatabase} from '../mock/db'
import {assessHarvest,defaultMaturityProfile,validateMaturityProfile} from '../shared/monitoring'
import {aggregateMonitoring} from '../mock/monitoring'
import {evaluateRidge} from '../shared/rules'
import {createMockServer} from '../mock/app'
import {loadMonitoringState,saveMonitoringState} from '../mock/monitoringStorage'

test('composite maturity uses capped weighted factors, missing data never yields readiness',()=>{
 const db=createDatabase(),r=db.ridges[0]!,p=defaultMaturityProfile('tomato')
 r.monitoring={colorMatch:80,fruitDiameter:4,plantWidth:25,leafGrowth:.2}
 assert.equal(assessHarvest(r,db.settings,p).score,90)
 assert.equal(assessHarvest(r,db.settings,p).ready,true)
 r.monitoring.colorMatch=100;assert.equal(assessHarvest(r,db.settings,p).score,90)
 r.monitoring.fruitDiameter=null;assert.equal(assessHarvest(r,db.settings,p).score,null)
 r.monitoring.fruitDiameter=4;r.fruitCount=0;assert.equal(assessHarvest(r,db.settings,p).ready,false)
 r.fruitCount=50;r.monitoring.colorMatch=0;assert.equal(assessHarvest(r,db.settings,p).score,40)
 r.monitoring.colorMatch=NaN;assert.equal(assessHarvest(r,db.settings,p).score,null)
 r.monitoring.colorMatch=80;r.sampledAt=new Date(Date.now()-8*86400000).toISOString();assert.equal(assessHarvest(r,db.settings,p).score,null)
 const invalid=structuredClone(p);invalid.criteria[1]!.key='colorMatch';assert.ok(validateMaturityProfile(invalid))
 invalid.criteria[1]!.key='fruitDiameter';invalid.criteria[1]!.weight=0;assert.ok(validateMaturityProfile(invalid))
})
test('leafy crop maturity and sample validation do not depend on fruit counts',()=>{
 const db=createDatabase(),r=db.ridges[0]!,p=defaultMaturityProfile('lettuce','leafy')
 r.monitoring={colorMatch:80,fruitDiameter:null,plantWidth:25,leafGrowth:.2};r.leafArea=35;r.fruitCount=0;r.lesions=0
 assert.equal(assessHarvest(r,db.settings,p).score,100)
 assert.equal(evaluateRidge(r,db.settings,Date.now(),p).harvestReady,true)
 assert.equal(evaluateRidge(r,db.settings,Date.now(),p).issues.includes('检测样本不足'),false)
 r.leafSampleCount=0;assert.equal(assessHarvest(r,db.settings,p).score,null)
})
test('monitor trends preserve gaps, relative leaf growth and current-batch isolation',()=>{
 const db=createDatabase(),r=db.ridges[0]!
 const rows=db.monitorObservations.filter(o=>o.ridgeId===r.id)
 for(let i=1;i<rows.length;i++)assert.ok(Math.abs(rows[i]!.leafArea-rows[i-1]!.leafArea-rows[i]!.leafGrowth!)<.011)
 const p=aggregateMonitoring(db,'tomato','week').series.find(s=>s.key==='leafGrowth')!.points
 assert.ok(p.some(x=>x.value!==null))
 db.monitorObservations.forEach(o=>{o.batch='old batch'})
 assert.ok(aggregateMonitoring(db,'tomato','week').series.every(s=>s.points.every(p=>p.value===null)))
 assert.equal(aggregateMonitoring(db,null,'week').series.length,0)
})
test('API persists crop criteria and immutable treatment snapshots, validates scope and stale writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'crop-monitor-test-')),file=join(dir,'state.json'),db=createDatabase()
 const server=createMockServer(db,0,state=>saveMonitoringState(file,state));server.listen(0,'127.0.0.1');await once(server,'listening')
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api'
 const call=async(path:string,method='GET',data?:unknown)=>{const res=await fetch(base+path,{method,headers:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return {status:res.status,...await res.json()}}
 try{
  const profile=defaultMaturityProfile('tomato');profile.readyScore=90
  assert.equal((await call('/crops/tomato/maturity-profile','PUT',profile)).status,200)
  const fields=(await call('/crops?fieldId=field-1')).data
  assert.equal(fields.find((c:any)=>c.id==='tomato').maturityProfile.readyScore,90)
  const broken=structuredClone(profile);broken.criteria[0]!.target=0
  assert.equal((await call('/crops/tomato/maturity-profile','PUT',broken)).status,422)
  const before=(await call('/ridges/ridge-1/anomalies')).data
  assert.ok(before.issues.length);assert.ok(before.photos[0].capturedAt)
  const input={batch:before.batch,plantedAt:before.plantedAt,sampledAt:before.sampledAt,description:'叶片出现褐色斑点',action:'已标记受影响植株，安排复查',status:'待复查'}
  assert.equal((await call('/ridges/ridge-1/anomalies','POST',{...input,action:''})).status,422)
  assert.equal((await call('/ridges/ridge-1/anomalies','POST',{...input,batch:'old'})).status,409)
  assert.equal((await call('/ridges/ridge-1/anomalies','POST',input)).status,201)
  assert.equal((await call('/ridges/ridge-1/anomalies?fieldId=field-1')).status,404)
  assert.equal((await call('/ridges/field-1-ridge-1/anomalies?fieldId=field-1')).data.records.length,0)
  db.ridges[0]!.lesions=0;db.ridges[0]!.sampledAt=new Date(Date.now()+1000).toISOString()
  const after=(await call('/ridges/ridge-1/anomalies')).data
  assert.equal(after.records[0].sampledAt,before.sampledAt)
  assert.match(after.records[0].photos[0].url,/diseased/)
  const restored=createDatabase();loadMonitoringState(file,restored)
  assert.equal(restored.crops[0]!.maturityProfile!.readyScore,90)
  assert.equal(restored.otherFields['field-1']!.crops[0]!.maturityProfile!.readyScore,90)
  assert.equal(restored.treatmentRecords[0]!.action,input.action)
  assert.equal((await call('/monitoring-trend?cropId=tomato&granularity=year')).status,400)
  assert.equal((await call('/monitoring-trend?cropId=tomato')).data.series.length,4)
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));rmSync(file,{force:true});rmdirSync(dir)}
})

test('compact fields contain chives with leafy monitoring and valid harvest references',()=>{
 const db=createDatabase()
 assert.deepEqual([db.otherFields['field-1']!.ridges.length,db.otherFields['field-2']!.ridges.length,db.ridges.length],[4,6,8])
 for(const field of [db,...Object.values(db.otherFields)]){
  assert.equal(field.crops.find(c=>c.id==='chive')!.maturityProfile!.kind,'leafy')
  assert.deepEqual(new Set(field.ridges.filter(r=>r.active).map(r=>r.cropId)),new Set(['tomato','strawberry','chive']))
  for(const h of field.harvests){const r=field.ridges.find(r=>r.id===h.ridgeId)!;assert.ok(r);assert.equal(h.cropId,r.cropId);assert.equal(h.batch,r.batch)}
  for(const r of field.ridges.filter(r=>r.cropId==='chive')){
   assert.equal(r.fruitCount,0);assert.equal(r.monitoring!.fruitDiameter,null)
   assert.ok(Number.isFinite(r.monitoring!.colorMatch))
   const profile=field.crops.find(c=>c.id==='chive')!.maturityProfile!
   assert.notEqual(assessHarvest(r,field.settings,profile).score,null)
   assert.ok(!evaluateRidge(r,field.settings,Date.now(),profile).issues.includes('检测样本不足'))
  }
  for(const period of ['week','month'] as const){
   const trend=aggregateMonitoring(field,'chive',period)
   assert.deepEqual(trend.series.map(s=>s.key),['leafGrowth','leafArea','plantWidth','colorMatch'])
   assert.ok(trend.series.every(s=>s.points.some(p=>p.value!==null)))
   assert.ok(trend.series.every(s=>s.points.every(p=>p.value===null||Number.isFinite(p.value))))
  }
 }
})

test('chives can be selected, planted and harvested without fruit detections',async()=>{
 const db=createDatabase(),server=createMockServer(db,0);server.listen(0,'127.0.0.1');await once(server,'listening')
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api'
 const call=async(path:string,body?:unknown)=>{const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,...await response.json()}}
 try{
  assert.equal((await call('/dashboard?cropId=chive')).data.fruitTotal,0)
  assert.deepEqual((await call('/ridges/ridge-3/detections')).data.items,[])
  const date=new Date().toISOString().slice(0,10)
  const planted=await call('/plantings',{ridgeId:'ridge-4',cropId:'chive',plants:40,plantedAt:date,batch:'韭菜新批次'})
  assert.equal(planted.status,201);assert.equal(planted.data.cropId,'chive')
  assert.equal((await call('/harvests',{ridgeId:'ridge-3',date,quantity:3,finish:false,note:'本次割收'})).status,201)
  assert.equal((await call('/ridges/ridge-3')).data.active,true)
  assert.equal((await call('/harvests?cropId=chive')).data.items[0].note,'本次割收')
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))}
})

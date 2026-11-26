import {test} from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {createMockServer} from '../mock/app'
import type {AddressInfo} from 'node:net'
test('API lifecycle, filtering, pagination and validation',async()=>{
 const server=createMockServer(undefined,0);server.listen(0,'127.0.0.1');await once(server,'listening')
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api'
 async function call(path:string,method='GET',data?:unknown){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,...await r.json()}}
 try{
 const list=await call('/ridges?page=1&pageSize=5');assert.equal(list.data.items.length,5);assert.equal(list.data.total,8);assert.ok(list.requestId);assert.equal(list.code,0)
 const before=await call('/dashboard?cropId=tomato');assert.ok(before.data.ridges.every((r:any)=>r.cropId==='tomato'));assert.equal(before.data.stages.reduce((s:number,x:any)=>s+x.value,0),before.data.fruitTotal)
 const all=await call('/dashboard');assert.equal(all.data.trend.length,0)
 assert.equal((await call('/ridges?page=-1')).status,400)
 assert.equal((await call('/ridges/missing')).status,404)
 assert.equal((await call('/dashboard?cropId=missing')).status,400)
 const date=new Date().toISOString().slice(0,10)
 assert.equal((await call('/plantings','POST',{ridgeId:'ridge-1',cropId:'tomato',plants:20,plantedAt:date,batch:'test'})).status,409)
 assert.equal((await call('/harvests','POST',{ridgeId:'ridge-1',date,quantity:-1,finish:false,note:''})).status,422)
 const ridge=(await call('/ridges/ridge-1')).data
 const end=await call('/harvests','POST',{ridgeId:ridge.id,date,quantity:10,finish:true,note:'test'});assert.equal(end.status,201)
 assert.equal((await call('/ridges/ridge-1')).data.active,false)
 const after=await call('/dashboard?cropId=tomato');assert.equal(before.data.plants-after.data.plants,ridge.plants)
 assert.equal((await call('/harvests','POST',{ridgeId:ridge.id,date,quantity:10,finish:true,note:''})).status,409)
 const plant=await call('/plantings','POST',{ridgeId:ridge.id,cropId:'strawberry',plants:50,plantedAt:date,batch:'new season'});assert.equal(plant.status,201);assert.equal(plant.data.quality,'待首次巡检')
 assert.equal((await call('/dashboard?cropId=strawberry')).data.concerns.some((r:any)=>r.id===ridge.id),false)
 const history=await call('/harvests');assert.equal(history.data.items[0].batch,ridge.batch);assert.equal(history.data.items[0].cropId,'tomato')
 assert.equal((await call('/settings','PUT',{minGrowth:8,maxGrowth:2,inspectionDays:3})).status,422)
 const setting=await call('/settings','PUT',{minGrowth:5,maxGrowth:7,inspectionDays:2});assert.equal(setting.data.minGrowth,5)
 assert.ok((await call('/dashboard?cropId=tomato')).data.attention>after.data.attention)
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})

test('collection images are served by backend and associated with their crop',async()=>{
 const server=createMockServer(undefined,0);server.listen(0,'127.0.0.1');await once(server,'listening')
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port
 try{
  const response=await fetch(base+'/api/crops'),payload=await response.json()
  assert.equal(payload.code,0)
  for(const id of ['tomato','strawberry']){
   const crop=payload.data.find((c:any)=>c.id===id),photo=crop.images[0]
   assert.equal(photo.id,id+'-field');assert.equal(photo.capturedAt,null)
   const file=await fetch(base+photo.url)
   assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),'image/png')
   const bytes=Buffer.from(await file.arrayBuffer())
   const original=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../mock/media/'+id+'-field.png',import.meta.url)))
   assert.deepEqual(bytes,original)
  }
  const missing=await fetch(base+'/api/media/unknown.png');assert.equal(missing.status,404)
  assert.equal((await missing.json()).code,404)
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})


test('detection images and harvest summary remain consistent with records',async()=>{
 const server=createMockServer(undefined,0);server.listen(0,'127.0.0.1');await once(server,'listening')
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port
 const get=async(path:string)=>(await (await fetch(base+'/api'+path)).json()).data
 try{
  for(const [id,result,target] of [['ridge-1','diseased','leaf'],['ridge-5','healthy','leaf'],['ridge-2','diseased','fruit'],['ridge-6','healthy','fruit']]){
   const d=await get('/ridges/'+id+'/detections');assert.equal(d.ridgeId,id);assert.equal(d.items[0].result,result);assert.equal(d.items[0].target,target);assert.equal(d.items[0].source,'ai-generated')
   const image=await fetch(base+d.items[0].url);assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');assert.ok((await image.arrayBuffer()).byteLength>10000)
  }
  assert.deepEqual((await get('/ridges/ridge-4/detections')).items,[])
  assert.equal((await fetch(base+'/api/ridges/missing/detections')).status,404)
  const summary=await get('/harvest-summary'),records=(await get('/harvests?pageSize=100')).items
  assert.equal(summary.byCrop.find((c:any)=>c.cropId==='tomato').totalKg,records.filter((h:any)=>h.cropId==='tomato').reduce((n:number,h:any)=>n+h.quantity,0))
  const ridge=(await get('/ridges/ridge-5')),before=summary.byCrop.find((c:any)=>c.cropId==='tomato').todayKg
  await fetch(base+'/api/harvests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ridgeId:ridge.id,date:summary.today,quantity:2.5,finish:false,note:''})})
  const after=await get('/harvest-summary');assert.equal(after.byCrop.find((c:any)=>c.cropId==='tomato').todayKg,before+2.5)
  assert.equal(after.byRidge.find((r:any)=>r.ridgeId===ridge.id).count,2)
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})

import {createDatabase,defaultSettings} from '../mock/db'
import {effectiveRules,evaluateRidge} from '../shared/rules'
test('rule boundaries, sample quality and inspection deadlines',()=>{
 const now=Date.now(),db=createDatabase(),r={...db.ridges[0]!,sampledAt:new Date(now).toISOString()},s=defaultSettings()
 r.growthCm=s.maxGrowth+0.1;assert.ok(evaluateRidge(r,s,now).issues.includes('长势偏快'))
 r.growthCm=s.maxGrowth;assert.ok(!evaluateRidge(r,s,now).issues.includes('长势偏快'))
 r.growthCm=s.minGrowth;assert.ok(!evaluateRidge(r,s,now).issues.includes('长势偏慢'))
 r.leafSampleCount=100;r.diseasedLeafCount=5;r.lesions=5
 assert.ok(evaluateRidge(r,s,now).issues.includes('病叶比例超限'))
 assert.ok(!evaluateRidge(r,{...s,leafDiseasePercent:6},now).issues.includes('病叶比例超限'))
 assert.ok(evaluateRidge(r,{...s,leafDiseasePercent:6},now).issues.includes('病斑待复核'))
 r.fruitCount=100;r.mature=60;r.diseasedFruitCount=5
 assert.equal(evaluateRidge(r,s,now).harvestReady,true)
 assert.ok(evaluateRidge(r,s,now).issues.includes('病果比例超限'))
 assert.equal(evaluateRidge(r,{...s,maturePercent:61},now).harvestReady,false)
 assert.ok(evaluateRidge(r,s,now+86400000).issues.includes('巡检已到期'))
 assert.ok(evaluateRidge(r,s,now+86400000).issues.includes('病斑复核已到期'))
 const stale=evaluateRidge(r,s,now+s.staleDays*86400000)
 assert.equal(stale.harvestReady,false);assert.ok(stale.issues.includes('巡检数据过期'))
 const insufficient=evaluateRidge({...r,plantSampleCount:0,leafSampleCount:0,fruitCount:0},s,now)
 assert.equal(insufficient.maturity,null);assert.equal(insufficient.leafRate,null);assert.ok(insufficient.issues.includes('检测样本不足'))
 assert.ok(!insufficient.issues.includes('长势偏慢'))
 assert.deepEqual(evaluateRidge({...r,active:false},s,now).issues,[])
 assert.deepEqual(evaluateRidge({...r,quality:'待首次巡检',sampledAt:''},s,now).issues,[])
})

test('scoped settings persist through API and update dashboard, with atomic validation',async()=>{
 const db=createDatabase(),server=createMockServer(db,0);server.listen(0,'127.0.0.1');await once(server,'listening')
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api'
 const call=async(path:string,data?:unknown)=>{const response=await fetch(base+path,{method:data===undefined?'GET':'PUT',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,...await response.json()}}
 try{
  const defaults=(await call('/settings/defaults')).data
  const {overrides,updatedAt,...rules}=defaults
  const before=(await call('/dashboard?cropId=strawberry')).data.attention
  const saved=await call('/settings',{...defaults,overrides:{tomato:{...rules,minGrowth:8,maxGrowth:9,inspectionDays:2}}})
  assert.equal(saved.status,200);assert.ok(saved.data.updatedAt)
  assert.equal((await call('/settings')).data.overrides.tomato.minGrowth,8)
  assert.equal((await call('/crops')).data.find((c:any)=>c.id==='tomato').intervalDays,2)
  assert.equal((await call('/dashboard?cropId=tomato')).data.attention,db.ridges.filter(r=>r.active&&r.cropId==='tomato').length)
  assert.equal((await call('/dashboard?cropId=strawberry')).data.attention,before)
  assert.equal(effectiveRules(db.settings,'tomato').minGrowth,8)
  const snapshot=JSON.stringify((await call('/settings')).data)
  for(const bad of [{maturePercent:101},{minFruitSamples:0},{inspectionDays:1.5},{staleDays:1},{reviewDays:8},{harvestInspectionDays:5},{overrides:{missing:rules}},{overrides:{tomato:{...rules,minGrowth:9,maxGrowth:1}}},{overrides:{tomato:null}},{unknownField:4}]){
   assert.equal((await call('/settings',bad)).status,422)
   assert.equal(JSON.stringify((await call('/settings')).data),snapshot)
  }
  await call('/settings',{overrides:{}})
  assert.equal((await call('/crops')).data.find((c:any)=>c.id==='tomato').intervalDays,3)
  const r=db.ridges.find(r=>r.id==='ridge-1')!;r.sampledAt=new Date(Date.now()-9*86400000).toISOString()
  assert.ok((await call('/dashboard?cropId=tomato')).data.concerns.some((x:any)=>x.id===r.id))
  assert.equal((await call('/settings/defaults')).data.minGrowth,2)
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})

import {summarizeCrops} from '../mock/cropSummary'
test('crop summaries aggregate current batches, valid samples and harvest history',()=>{
 const db=createDatabase(),now=Date.now()
 for(const s of summarizeCrops(db,now)){
  const rows=db.ridges.filter(r=>r.active&&r.cropId===s.cropId)
  assert.equal(s.activeRidges,rows.length)
  assert.equal(s.plants,rows.reduce((n,r)=>n+r.plants,0))
  assert.equal(s.batches,new Set(rows.map(r=>r.batch)).size)
  assert.equal(s.validFruitCount,rows.reduce((n,r)=>n+r.fruitCount,0))
  assert.equal(s.matureFruitCount,rows.reduce((n,r)=>n+r.mature,0))
  assert.equal(s.attentionRidges,rows.filter(r=>evaluateRidge(r,effectiveRules(db.settings,r.cropId),now,db.crops.find(c=>c.id===r.cropId)?.maturityProfile).issues.length).length)
  assert.equal(s.totalHarvestKg,db.harvests.filter(h=>h.cropId===s.cropId).reduce((n,h)=>n+h.quantity,0))
 }
 const tomato=db.ridges.filter(r=>r.cropId==='tomato')
 tomato.forEach(r=>{r.sampledAt=new Date(now-10*86400000).toISOString()})
 let s=summarizeCrops(db,now).find(c=>c.cropId==='tomato')!
 assert.equal(s.averageGrowth,null);assert.equal(s.validFruitCount,0);assert.equal(s.harvestReadyRidges,0)
 tomato.forEach(r=>{r.active=false})
 s=summarizeCrops(db,now).find(c=>c.cropId==='tomato')!
 assert.equal(s.activeRidges,0);assert.equal(s.plants,0);assert.equal(s.latestInspectionAt,null);assert.ok(s.totalHarvestKg>0)
})
test('crop summary endpoint exposes typed aggregate payload',async()=>{
 const db=createDatabase(),server=createMockServer(db,0);server.listen(0,'127.0.0.1');await once(server,'listening')
 try{
  const response=await fetch('http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/crop-summaries')
  const payload=await response.json();assert.equal(response.status,200);assert.equal(payload.code,0);assert.deepEqual(payload.data,summarizeCrops(db));assert.ok(payload.requestId)
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})

import {aggregateGrowthTrend} from '../mock/growthTrend'
test('growth trend groups dated samples by calendar period with gaps and batch isolation',()=>{
 const db=createDatabase(),now=Date.parse('2027-01-15T04:00:00Z'),r=db.ridges.find(r=>r.id==='ridge-1')!
 r.plantedAt='2026-11-01';r.batch='current'
 const observation={ridgeId:r.id,cropId:r.cropId,batch:r.batch,plantedAt:r.plantedAt,plantSamples:10,previousDate:'2026-12-30'}
 db.growthObservations=[{...observation,date:'2026-12-31',growthCm:20},{...observation,date:'2027-01-01',growthCm:30},{...observation,date:'2027-01-12',growthCm:40,plantSamples:30},{...observation,date:'2027-01-14',growthCm:999,plantSamples:1},{...observation,date:'2027-01-13',growthCm:999,batch:'old'},{...observation,date:'2027-01-16',growthCm:999}]
 const month=aggregateGrowthTrend(db,'tomato','month',now)
 assert.equal(month.points.length,6);assert.equal(month.points[0]!.label,'2026-08')
 assert.equal(month.points[0]!.value,null)
 assert.equal(month.points[4]!.value,20);assert.equal(month.points[5]!.value,37.5)
 assert.equal(month.points[5]!.periodEnd,'2027-01-15')
 const week=aggregateGrowthTrend(db,'tomato','week',now)
 assert.equal(week.points.at(-1)!.periodStart,'2027-01-11');assert.equal(week.points.at(-1)!.value,40)
 assert.equal(week.points.find(p=>p.periodStart==='2026-12-28')!.value,25)
 const daily=aggregateGrowthTrend(db,'tomato','week',now,true)
 assert.equal(daily.sampling,'day');assert.equal(daily.points[0]!.periodStart,'2026-12-31')
 assert.equal(daily.points.length,16);assert.equal(daily.points.at(-1)!.periodEnd,'2027-01-15')
 assert.equal(daily.points.find(p=>p.periodStart==='2027-01-01')!.value,30)
 assert.equal(daily.points.find(p=>p.periodStart==='2027-01-12')!.value,40)
 assert.equal(daily.points.find(p=>p.periodStart==='2027-01-13')!.value,null)
 assert.equal(daily.points.find(p=>p.periodStart==='2027-01-14')!.value,null)
 const detailedMonth=aggregateGrowthTrend(db,'tomato','month',now,true)
 assert.equal(detailedMonth.sampling,'week');assert.equal(detailedMonth.points.length,3)
 assert.equal(detailedMonth.points[0]!.value,25);assert.equal(detailedMonth.points[1]!.value,null);assert.equal(detailedMonth.points[2]!.value,40)
 assert.deepEqual(aggregateGrowthTrend(db,'strawberry','month',now,true).points,[])
 assert.deepEqual(aggregateGrowthTrend(db,null,'month',now).points,[])
 assert.ok(aggregateGrowthTrend(db,'strawberry','month',now).points.every(p=>p.value===null))
 r.active=false;assert.ok(aggregateGrowthTrend(db,'tomato','month',now).points.every(p=>p.value===null))
})
test('growth trend API validates period and returns week or month aggregates',async()=>{
 const db=createDatabase(),server=createMockServer(db,0);server.listen(0,'127.0.0.1');await once(server,'listening')
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/growth-trend'
 try{
  for(const granularity of ['week','month'] as const){
   const response=await fetch(base+'?cropId=tomato&granularity='+granularity),body=await response.json()
   assert.equal(response.status,200);assert.equal(body.code,0);assert.equal(body.data.granularity,granularity);assert.equal(body.data.unit,'cm');assert.deepEqual(body.data,aggregateGrowthTrend(db,'tomato',granularity))
  }
  for(const granularity of ['week','month'] as const){
   const response=await fetch(base+'?cropId=tomato&granularity='+granularity+'&detail=true'),body=await response.json()
   assert.equal(response.status,200);assert.deepEqual(body.data,aggregateGrowthTrend(db,'tomato',granularity,Date.now(),true))
   assert.ok(body.data.points.filter((p:any)=>p.value!==null).length>6)
  }
  assert.equal((await fetch(base+'?cropId=tomato&detail=bad')).status,400)
  assert.equal((await fetch(base+'?cropId=tomato&granularity=year')).status,400)
  assert.equal((await fetch(base+'?cropId=missing')).status,400)
  const all=await (await fetch(base+'?granularity=month')).json();assert.deepEqual(all.data.points,[])
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})

test('field selection scopes all summaries, trends, ridges and harvest writes',async()=>{
 const db=createDatabase(),server=createMockServer(db,0);server.listen(0,'127.0.0.1');await once(server,'listening')
 const base='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api'
 const get=async(path:string)=>{const res=await fetch(base+path);return {status:res.status,...await res.json()}}
 try{
  const farms=(await get('/farms')).data;assert.deepEqual(farms,[{id:'qinghe',name:'青禾农场'}]);assert.equal((await get('/profile?farmId=qinghe')).data.farmId,'qinghe');assert.equal((await get('/fields?farmId=missing')).status,400)
  assert.equal((await get('/fields?farmId=qinghe')).data.length,3)
  for(const id of ['field-1','field-2','field-3']){
   const expected=id==='field-3'?db:db.otherFields[id]!
   assert.equal((await get('/profile?fieldId='+id)).data.fieldId,id)
   assert.equal((await get('/ridges?fieldId='+id+'&pageSize=100')).data.total,expected.ridges.length)
   assert.deepEqual((await get('/crop-summaries?fieldId='+id)).data,summarizeCrops(expected))
   assert.deepEqual((await get('/growth-trend?fieldId='+id+'&cropId=tomato&granularity=month')).data,aggregateGrowthTrend(expected,'tomato','month'))
   const dashboard=(await get('/dashboard?fieldId='+id)).data
   assert.equal(dashboard.plants,expected.ridges.filter(r=>r.active).reduce((n,r)=>n+r.plants,0))
   assert.ok(dashboard.ridges.every((r:any)=>expected.ridges.some(x=>x.id===r.id)))
  }
  assert.equal((await get('/ridges?fieldId=unknown')).status,400)
  assert.equal((await get('/ridges/ridge-1?fieldId=field-1')).status,404)
  const before=db.harvests.length,first=db.otherFields['field-1']!,record={ridgeId:first.ridges[0]!.id,date:new Date().toISOString().slice(0,10),quantity:2,finish:false,note:'field scope test'}
  const response=await fetch(base+'/harvests?fieldId=field-1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)})
  assert.equal(response.status,201);assert.equal(first.harvests.length,9);assert.equal(db.harvests.length,before)
  assert.equal((await get('/harvests?fieldId=field-1')).data.items[0].note,'field scope test')
  assert.equal((await get('/harvests?fieldId=field-3')).data.total,before)
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))}
})

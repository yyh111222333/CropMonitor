import {aggregateMonitoring,anomalyDetail} from './monitoring'
import {validateMaturityProfile,type TreatmentRecord} from '../shared/monitoring'
import {monitoringState,applyMonitoringState,type MonitoringState} from './monitoringStorage'
import {aggregateGrowthTrend} from './growthTrend'
import {summarizeCrops} from './cropSummary'
import {readFile} from 'node:fs/promises'
import {createServer} from 'node:http'
import {randomUUID} from 'node:crypto'
import {createDatabase,defaultSettings,type Database} from './db'
import type {Dashboard,Settings,RuleSettings} from '../shared/contracts'
import {effectiveRules,evaluateRidge,validateRules} from '../shared/rules'
class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
function validDate(v:unknown):v is string{return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v<=new Date().toISOString().slice(0,10)}
export function createMockServer(database:Database=createDatabase(),latency=250,persist?:(state:MonitoringState)=>void){
 return createServer(async(req,res)=>{
 const requestId=randomUUID()
 const send=(status:number,data:unknown,message='success')=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({code:status<400?0:status,message,data,requestId,timestamp:new Date().toISOString()}))}
 try{
 await new Promise(r=>setTimeout(r,latency))
 const url=new URL(req.url||'/','http://localhost'),p=url.pathname,m=req.method,cropId=url.searchParams.get('cropId')
 if(m==='GET'&&p==='/api/farms')return send(200,database.farms)
 const farmId=url.searchParams.get('farmId')||database.farms[0]!.id,farm=database.farms.find(f=>f.id===farmId)
 if(!farm)throw new HttpError(400,'农场筛选值无效')
 const fieldId=url.searchParams.get('fieldId')||'field-3',field=database.fields.find(f=>f.id===fieldId)
 if(!field)throw new HttpError(400,'田块筛选值无效')
 const db=fieldId==='field-3'?database:database.otherFields[fieldId]!
 db.settings=database.settings
 if(m==='GET'&&p==='/api/fields')return send(200,database.fields)
 if(m==='GET'&&p.startsWith('/api/media/')){
 const name=p.slice('/api/media/'.length)
 if(!['tomato-field.png','strawberry-field.png','tomato-healthy-clean.png','tomato-diseased-clean.png','strawberry-healthy-clean.png','strawberry-diseased-clean.png'].includes(name))throw new HttpError(404,'图片不存在')
 const bytes=await readFile(new URL('./media/'+name,import.meta.url))
 res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'});return res.end(bytes)
 }
 if(cropId&&!db.crops.some(c=>c.id===cropId))throw new HttpError(400,'作物筛选值无效')
 const selected=db.ridges.filter(r=>!cropId||r.cropId===cropId)
 const body=async()=>{let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>1e6)throw new HttpError(413,'请求内容过大')}try{const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error();return parsed}catch{throw new HttpError(400,'请求必须是有效JSON')}}
 const pagination=<T,>(items:T[])=>{const page=Number(url.searchParams.get('page')||1),pageSize=Number(url.searchParams.get('pageSize')||10);if(!Number.isInteger(page)||page<1||!Number.isInteger(pageSize)||pageSize<1||pageSize>100)throw new HttpError(400,'分页参数无效');return {items:items.slice((page-1)*pageSize,page*pageSize),total:items.length,page,pageSize}}
 if(m==='GET'&&p==='/api/profile')return send(200,{farmId,name:farm.name,fieldId,fieldName:field.name,operator:'农场管理员'})
 if(m==='GET'&&p==='/api/crop-summaries')return send(200,summarizeCrops(db))
 if(m==='GET'&&['/api/growth-trend','/api/monitoring-trend'].includes(p)&&!['increment','size'].includes(url.searchParams.get('mode')??'increment'))throw new HttpError(400,'趋势口径须为 increment 或 size')
 if(m==='GET'&&p==='/api/growth-trend'){const granularity=url.searchParams.get('granularity')??'week';if(granularity!=='week'&&granularity!=='month')throw new HttpError(400,'统计周期须为 week 或 month');const detail=url.searchParams.get('detail')??'false';if(detail!=='true'&&detail!=='false')throw new HttpError(400,'detail 须为 true 或 false');return send(200,aggregateGrowthTrend(db,cropId,granularity,Date.now(),detail==='true',url.searchParams.get('mode')==='size'))}
 if(m==='GET'&&p==='/api/crops')return send(200,db.crops.map(c=>({...c,intervalDays:effectiveRules(db.settings,c.id).inspectionDays})))
 if(m==='GET'&&p==='/api/monitoring-trend'){
 const g=url.searchParams.get('granularity')||'week';if(g!=='week'&&g!=='month')throw new HttpError(400,'统计周期无效')
 return send(200,aggregateMonitoring(db,cropId,g,Date.now(),url.searchParams.get('mode')==='size'))
 }
 if(m==='PUT'&&/^\/api\/crops\/[^/]+\/maturity-profile$/.test(p)){
 const c=database.crops.find(c=>c.id===p.split('/')[3]);if(!c)throw new HttpError(404,'作物不存在')
 const b=await body(),error=validateMaturityProfile(b);if(error)throw new HttpError(422,error)
 const state=structuredClone(monitoringState(database));state.profiles[c.id]=b
 persist?.(state);applyMonitoringState(database,state)
 return send(200,c.maturityProfile,'成熟指标已保存')
 }
 if(/^\/api\/ridges\/[^/]+\/anomalies$/.test(p)){
 const r=db.ridges.find(r=>r.id===p.split('/')[3]);if(!r)throw new HttpError(404,'田垄不存在')
 const detail=anomalyDetail(db,database,r,farmId,fieldId)
 if(m==='GET')return send(200,detail)
 if(m==='POST'){
 const b=await body()
 if(!r.active||b.batch!==r.batch||b.plantedAt!==r.plantedAt||b.sampledAt!==r.sampledAt)throw new HttpError(409,'田垄批次或检测已更新，请重新加载后记录')
 if(typeof b.description!=='string'||!b.description.trim()||b.description.length>1000||typeof b.action!=='string'||!b.action.trim()||b.action.length>1000||!['处理中','待复查','已完成'].includes(b.status))throw new HttpError(422,'请填写异常描述、处理内容（各不超过 1000 字）和有效状态')
 const record:TreatmentRecord={id:randomUUID(),farmId,fieldId,ridgeId:r.id,batch:r.batch,plantedAt:r.plantedAt,sampledAt:r.sampledAt,createdAt:new Date().toISOString(),description:b.description.trim(),action:b.action.trim(),status:b.status,photos:structuredClone(detail.photos),issues:[...detail.issues]}
 const state=structuredClone(monitoringState(database));state.records.push(record)
 persist?.(state);applyMonitoringState(database,state)
 return send(201,record,'处理记录已保存')
 }
 }
 if(m==='GET'&&p==='/api/ridges')return send(200,pagination(selected))
 if(m==='GET'&&/^\/api\/ridges\/[^/]+\/detections$/.test(p)){
 const ridge=db.ridges.find(r=>r.id===p.split('/')[3]);if(!ridge)throw new HttpError(404,'田垄不存在')
 const result=ridge.lesions>0?'diseased':'healthy',target=ridge.cropId==='tomato'?'leaf':'fruit'
 const title=(target==='leaf'?'番茄叶片':'草莓果实')+' · '+(result==='diseased'?'有病':'无病')
 return send(200,{ridgeId:ridge.id,items:ridge.active&&ridge.quality==='可用'&&['tomato','strawberry'].includes(ridge.cropId)?[{id:ridge.id+'-inspection',url:'/api/media/'+ridge.cropId+'-'+result+'-clean.png',title,capturedAt:null,target,result,source:'ai-generated'}]:[]})
 }
 if(m==='GET'&&p==='/api/harvest-summary'){
 const now=new Date(Date.now()+8*3600000),today=now.toISOString().slice(0,10),monday=new Date(now);monday.setUTCDate(now.getUTCDate()-(now.getUTCDay()+6)%7);const weekStart=monday.toISOString().slice(0,10)
 const sum=(rows:typeof db.harvests)=>Math.round(rows.reduce((n,h)=>n+h.quantity,0)*100)/100
 return send(200,{today,weekStart,byCrop:db.crops.map(c=>{const rows=db.harvests.filter(h=>h.cropId===c.id);return {cropId:c.id,todayKg:sum(rows.filter(h=>h.date===today)),weekKg:sum(rows.filter(h=>h.date>=weekStart&&h.date<=today)),totalKg:sum(rows)}}),byRidge:db.ridges.filter(r=>r.active).map(r=>{const rows=db.harvests.filter(h=>h.ridgeId===r.id&&h.cropId===r.cropId&&h.batch===r.batch&&h.date>=r.plantedAt);return {ridgeId:r.id,batch:r.batch,quantity:sum(rows),count:rows.length}})})
 }
 if(m==='GET'&&p.startsWith('/api/ridges/')){const r=db.ridges.find(r=>r.id===p.split('/').at(-1));if(!r)throw new HttpError(404,'田垄不存在');return send(200,r)}
 if(m==='GET'&&p==='/api/dashboard'){
 const rs=selected.filter(r=>r.active),valid=rs.filter(r=>evaluateRidge(r,effectiveRules(db.settings,r.cropId),Date.now(),db.crops.find(c=>c.id===r.cropId)?.maturityProfile).usable&&r.plantSampleCount>=effectiveRules(db.settings,r.cropId).minPlantSamples)
 const sum=(key:'plants'|'fruitCount'|'mature'|'turning'|'immature'|'unknown')=>(key==='plants'?rs:rs.filter(r=>evaluateRidge(r,effectiveRules(db.settings,r.cropId),Date.now(),db.crops.find(c=>c.id===r.cropId)?.maturityProfile).maturity!==null)).reduce((s,r)=>s+r[key],0)
 const concerns=rs.filter(r=>evaluateRidge(r,effectiveRules(db.settings,r.cropId),Date.now(),db.crops.find(c=>c.id===r.cropId)?.maturityProfile).issues.length),samples=valid.reduce((s,r)=>s+r.plantSampleCount,0)
 const data:Dashboard={plants:sum('plants'),batches:new Set(rs.map(r=>r.cropId+r.batch)).size,attention:concerns.length,harvests:db.harvests.filter(h=>!cropId||h.cropId===cropId).length,fruitTotal:sum('fruitCount'),stages:[{name:'成熟',value:sum('mature')},{name:'转色',value:sum('turning')},{name:'未成熟',value:sum('immature')},{name:'不确定',value:sum('unknown')}],trend:[],ridges:rs,concerns,updatedAt:new Date().toISOString()};return send(200,data)
 }
 if(m==='GET'&&p==='/api/harvests')return send(200,pagination(db.harvests.filter(h=>!cropId||h.cropId===cropId)))
 if(m==='POST'&&p==='/api/harvests'){
 const b=await body(),r=db.ridges.find(r=>r.id===b.ridgeId)
 if(!r)throw new HttpError(404,'田垄不存在');if(!r.active)throw new HttpError(409,'该田垄已结束种植，请刷新重试')
 if(typeof b.quantity!=='number'||!Number.isFinite(b.quantity)||b.quantity<=0||typeof b.finish!=='boolean'||!validDate(b.date)||typeof b.note!=='string'||b.note.length>500)throw new HttpError(422,'请检查采收日期、正数重量和备注')
 if(b.date<r.plantedAt)throw new HttpError(422,'采收日期不能早于种植日期')
 const record={id:randomUUID(),ridgeId:r.id,cropId:r.cropId,batch:r.batch,date:b.date,quantity:b.quantity,unit:'kg' as const,finish:b.finish,note:b.note};db.harvests.unshift(record)
 if(b.finish){r.active=false;r.plants=0;r.quality='已结束种植'}
 return send(201,record,'采收记录已保存')
 }
 if(m==='POST'&&p==='/api/plantings'){
 const b=await body(),r=db.ridges.find(r=>r.id===b.ridgeId)
 if(!r)throw new HttpError(404,'田垄不存在');if(r.active)throw new HttpError(409,'该田垄正在种植，不可创建重叠批次')
 if(!db.crops.some(c=>c.id===b.cropId)||!Number.isInteger(b.plants)||b.plants<1||b.plants>10000||!validDate(b.plantedAt)||typeof b.batch!=='string'||!b.batch.trim()||b.batch.length>60)throw new HttpError(422,'请检查品种、苗数、种植日期和批次名称')
 Object.assign(r,{cropId:b.cropId,plants:b.plants,plantedAt:b.plantedAt,batch:b.batch.trim(),active:true,plantSampleCount:0,leafSampleCount:0,diseasedLeafCount:0,diseasedFruitCount:0,sampledAt:'',monitoring:undefined,growthCm:null,previousSampledAt:null,leafArea:0,fruitCount:0,mature:0,turning:0,immature:0,unknown:0,lesions:0,quality:'待首次巡检'})
 return send(201,r,'种植批次已创建')
 }
 if(m==='GET'&&p==='/api/settings')return send(200,db.settings)
 if(m==='GET'&&p==='/api/settings/defaults')return send(200,defaultSettings())
 if(m==='PUT'&&p==='/api/settings'){
 const b=await body(),allowed=Object.keys(defaultSettings())
 if(Object.keys(b).some(k=>!allowed.includes(k)))throw new HttpError(422,'包含未知参数')
 const next:Settings={...db.settings,...b,updatedAt:new Date().toISOString()}
 const problem=validateRules(next);if(problem)throw new HttpError(422,problem)
 if(!next.overrides||typeof next.overrides!=='object'||Array.isArray(next.overrides))throw new HttpError(422,'作物参数格式错误')
 for(const [id,rules] of Object.entries(next.overrides)){
 if(!db.crops.some(c=>c.id===id)||!rules||typeof rules!=='object'||Array.isArray(rules))throw new HttpError(422,'作物参数范围无效')
 if(Object.keys(rules).some(k=>!allowed.includes(k)||k==='overrides'||k==='updatedAt'))throw new HttpError(422,'作物包含未知参数')
 const error=validateRules(rules as RuleSettings);if(error)throw new HttpError(422,error)
 }
 database.settings=structuredClone(next);db.settings=database.settings;return send(200,db.settings)
 }

 throw new HttpError(404,'接口不存在')
 }catch(e){send(e instanceof HttpError?e.status:500,null,e instanceof HttpError?e.message:'服务内部异常')}
 })
}
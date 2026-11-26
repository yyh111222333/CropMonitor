import {seedMonitoring} from './monitoring'
import {defaultMaturityProfile,type TreatmentRecord} from '../shared/monitoring'
import {createGrowthObservations} from './growthTrend'
import type {Crop,Ridge,Harvest,Settings} from '../shared/contracts'
export function defaultSettings():Settings{return {minGrowth:2,maxGrowth:6,inspectionDays:3,leafDiseasePercent:5,fruitDiseasePercent:5,reviewDays:1,maturePercent:60,harvestInspectionDays:1,staleDays:7,minPlantSamples:10,minLeafSamples:20,minFruitSamples:20,overrides:{},updatedAt:null}}
function createFieldDatabase(seed=20261116,fieldId='field-3',count=8){
 let state=seed>>>0;const rand=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296}
 const int=(a:number,b:number)=>Math.floor(rand()*(b-a+1))+a
 const date=(days:number)=>new Date(Date.now()-days*86400000).toISOString().slice(0,10)
 const crops:Crop[]=[{images:[{id:'tomato-field',url:'/api/media/tomato-field.png',title:'小番茄田采集照片',capturedAt:null}],id:'tomato',name:'西红柿',cultivar:'红星1号',color:'#079b75',intervalDays:3},{images:[{id:'strawberry-field',url:'/api/media/strawberry-field.png',title:'草莓田采集照片',capturedAt:null}],id:'strawberry',name:'草莓',cultivar:'红颜',color:'#f18781',intervalDays:2},{images:[],id:'chive',name:'韭菜',cultivar:'宽叶韭菜',color:'#4d9b45',intervalDays:3}]
 const ridges:Ridge[]=Array.from({length:count},(_,i)=>{
 const n=i+1,active=n%4!==0,cropId=['tomato','strawberry','chive','tomato'][i%4]!;rand()
 const growthCm=n===7?1.4:Math.round((2.5+rand()*2)*10)/10
 const fruits=active&&cropId!=='chive'?int(40,90):0,mature=Math.floor(fruits*(.15+rand()*.55)),turning=Math.floor(fruits*.2),unknown=Math.floor(fruits*.1)
 const lesions=active&&[1,2].includes(n)?int(8,18):0
 return {plantSampleCount:active?30:0,leafSampleCount:active?80:0,diseasedLeafCount:cropId!=='strawberry'?lesions:0,diseasedFruitCount:cropId==='strawberry'?lesions:0,id:'ridge-'+n,number:n,cropId,active,batch:'秋季'+(n<=4?'A':'B'),plantedAt:date(56),plants:active?int(36,60):0,growthCm:active?growthCm:null,previousSampledAt:active?new Date(Date.now()-86400000).toISOString():null,leafArea:int(22,36),fruitCount:fruits,mature,turning,unknown,immature:fruits-mature-turning-unknown,lesions,sampledAt:new Date().toISOString(),quality:active?'可用':'未种植'}
 })
 const planted=ridges.filter(r=>r.active)
 const harvests:Harvest[]=Array.from({length:8},(_,i)=>{const r=planted[i%planted.length]!;return {id:'harvest-'+i,ridgeId:r.id,cropId:r.cropId,batch:r.batch,date:date(i+1),quantity:int(8,24),unit:'kg',finish:false,note:'分批采收'}})
 if(fieldId!=='field-3'){ridges.forEach(r=>{r.id=fieldId+'-'+r.id});harvests.forEach(h=>{h.id=fieldId+'-'+h.id;h.ridgeId=fieldId+'-'+h.ridgeId})}
 crops.forEach(c=>c.maturityProfile=defaultMaturityProfile(c.id))
 const monitorObservations=seedMonitoring(ridges)
 const settings=defaultSettings()
 return {monitorObservations,crops,ridges,harvests,settings,growthObservations:createGrowthObservations(ridges)}
}
export type FieldDatabase=ReturnType<typeof createFieldDatabase>
export function createDatabase(seed=20261116){return {treatmentRecords:[] as TreatmentRecord[],...createFieldDatabase(seed),farms:[{id:'qinghe',name:'青禾农场'}],fields:[{id:'field-1',name:'1号田'},{id:'field-2',name:'2号田'},{id:'field-3',name:'3号田'}],otherFields:{'field-1':createFieldDatabase(seed+11,'field-1',4),'field-2':createFieldDatabase(seed+22,'field-2',6)} as Record<string,FieldDatabase>}}
export type Database=ReturnType<typeof createDatabase>

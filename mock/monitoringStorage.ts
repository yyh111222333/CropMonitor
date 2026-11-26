import {existsSync,readFileSync,mkdirSync,writeFileSync,renameSync} from 'node:fs'
import {dirname} from 'node:path'
import type {Database} from './db'
import {validateMaturityProfile,type MaturityProfile,type TreatmentRecord} from '../shared/monitoring'
export interface MonitoringState {profiles:Record<string,MaturityProfile>;records:TreatmentRecord[]}
export function monitoringState(db:Database):MonitoringState {
 return {profiles:Object.fromEntries(db.crops.filter(c=>c.maturityProfile).map(c=>[c.id,c.maturityProfile!])),records:db.treatmentRecords}
}
export function applyMonitoringState(db:Database,state:MonitoringState){
 for(const field of [db,...Object.values(db.otherFields)])for(const c of field.crops)if(state.profiles[c.id])c.maturityProfile=structuredClone(state.profiles[c.id])
 db.treatmentRecords=structuredClone(state.records)
}
export function loadMonitoringState(path:string,db:Database){
 if(!existsSync(path))return
 const state=JSON.parse(readFileSync(path,'utf8')) as MonitoringState
 if(!state.profiles||Object.values(state.profiles).some(p=>validateMaturityProfile(p))||!Array.isArray(state.records))throw new Error('监测记录文件格式错误，请检查文件备份')
 applyMonitoringState(db,state)
}
export function saveMonitoringState(path:string,state:MonitoringState){
 mkdirSync(dirname(path),{recursive:true})
 const temp=path+'.tmp'
 writeFileSync(temp,JSON.stringify(state,null,2),'utf8')
 renameSync(temp,path)
}

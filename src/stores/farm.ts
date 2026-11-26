import {assessHarvest,defaultMaturityProfile,type MonitoringTrend} from '../../shared/monitoring'
import {effectiveRules,evaluateRidge} from '../../shared/rules'
import {defineStore} from 'pinia'
import {ref} from 'vue'
import {cropApi,setApiField,setApiFarm} from '../api/crop'
import type {Farm,Field,GrowthTrend,TrendGranularity,FarmProfile,CropSummary,Crop,Dashboard,Ridge,Settings} from '../../shared/contracts'
export const useFarm=defineStore('farm',()=>{
const monitoringTrend=ref<MonitoringTrend|null>(null)
const trendGranularity=ref<TrendGranularity>('week'),growthTrend=ref<GrowthTrend|null>(null),trendLoading=ref(false),trendError=ref('');let trendRevision=0
async function refreshGrowthTrend(){const version=++trendRevision;trendLoading.value=true;trendError.value='';try{const [data,monitor]=await Promise.all([cropApi.growthTrend(cropId.value,trendGranularity.value),cropApi.monitoringTrend(cropId.value,trendGranularity.value)]);if(version===trendRevision){growthTrend.value=data;monitoringTrend.value=monitor}}catch(e){if(version===trendRevision){growthTrend.value=null;monitoringTrend.value=null;trendError.value=e instanceof Error?e.message:'趋势加载失败'}}finally{if(version===trendRevision)trendLoading.value=false}}
function setTrendGranularity(value:TrendGranularity){if(trendGranularity.value!==value){trendGranularity.value=value;void refreshGrowthTrend()}}
const farms=ref<Farm[]>([]),farmId=ref(''),fields=ref<Field[]>([]),fieldId=ref('')
async function selectFarm(id:string){if(!farms.value.some(f=>f.id===id)||id===farmId.value)return;farmId.value=id;setApiFarm(id);fieldId.value='';setApiField('');fields.value=[];dashboard.value=null;ridges.value=[];cropSummaries.value=[];await refresh()}
async function selectField(id:string){if(!fields.value.some(f=>f.id===id)||id===fieldId.value)return;fieldId.value=id;setApiField(id);dashboard.value=null;ridges.value=[];cropSummaries.value=[];await refresh()}
const cropSummaries=ref<CropSummary[]>([])
const profile=ref<FarmProfile|null>(null);const crops=ref<Crop[]>([]),ridges=ref<Ridge[]>([]),dashboard=ref<Dashboard|null>(null),settings=ref<Settings|null>(null),cropId=ref('tomato'),loading=ref(false),error=ref('');let revision=0
async function refresh(){void refreshGrowthTrend();const version=++revision;loading.value=true;error.value='';try{const [c,r,d,s,p,cs,fs,fms]=await Promise.all([cropApi.crops(),cropApi.ridges(),cropApi.dashboard(cropId.value),cropApi.settings(),cropApi.profile(),cropApi.cropSummaries(),cropApi.fields(),cropApi.farms()]);if(version!==revision)return;farms.value=fms;farmId.value=p.farmId;setApiFarm(p.farmId);fields.value=fs;fieldId.value=p.fieldId;setApiField(p.fieldId);cropSummaries.value=cs;profile.value=p;crops.value=c;ridges.value=r.items;dashboard.value=d;settings.value=s}catch(e){if(version===revision)error.value=e instanceof Error?e.message:'加载失败'}finally{if(version===revision)loading.value=false}}
function cropName(id:string){const c=crops.value.find(c=>c.id===id);return c?c.name+' · '+c.cultivar:'未关联作物'}
function assessment(r:Ridge){return settings.value?evaluateRidge(r,effectiveRules(settings.value,r.cropId),Date.now(),crops.value.find(c=>c.id===r.cropId)?.maturityProfile):null}
function harvestAssessment(r:Ridge){return settings.value?assessHarvest(r,effectiveRules(settings.value,r.cropId),crops.value.find(c=>c.id===r.cropId)?.maturityProfile??defaultMaturityProfile(r.cropId)):null}
function status(r:Ridge){return assessment(r)?.status??'加载中'}

return {monitoringTrend,harvestAssessment,farms,farmId,selectFarm,fields,fieldId,selectField,growthTrend,trendGranularity,trendLoading,trendError,refreshGrowthTrend,setTrendGranularity,cropSummaries,profile,crops,ridges,dashboard,settings,cropId,loading,error,refresh,cropName,status,assessment}
})
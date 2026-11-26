import type {MaturityProfile,MonitoringTrend,AnomalyDetail,TreatmentInput,TreatmentRecord} from '../../shared/monitoring'
import {request} from './http'
import type {AxiosRequestConfig} from 'axios'
let currentFieldId='',currentFarmId=''
export function setApiFarm(id:string){currentFarmId=id}
export function setApiField(id:string){currentFieldId=id}
function scoped<T>(config:AxiosRequestConfig){return request<T>({...config,params:{...config.params,farmId:currentFarmId||undefined,fieldId:currentFieldId||undefined}})}
import type {Farm,Field,GrowthTrend,TrendGranularity,DetectionResult,HarvestSummary,CropSummary,FarmProfile,Crop,Dashboard,Page,Ridge,Harvest,HarvestInput,PlantInput,Settings} from '../../shared/contracts'
export const cropApi={
 monitoringTrend:(cropId:string,granularity:TrendGranularity)=>scoped<MonitoringTrend>({url:'/monitoring-trend',params:{cropId:cropId||undefined,granularity,mode:'size'}}),
 saveMaturity:(id:string,data:MaturityProfile)=>scoped<MaturityProfile>({url:'/crops/'+encodeURIComponent(id)+'/maturity-profile',method:'PUT',data}),
 anomalies:(id:string)=>scoped<AnomalyDetail>({url:'/ridges/'+encodeURIComponent(id)+'/anomalies'}),
 treatment:(id:string,data:TreatmentInput)=>scoped<TreatmentRecord>({url:'/ridges/'+encodeURIComponent(id)+'/anomalies',method:'POST',data}),
 farms:()=>request<Farm[]>({url:'/farms'}),
 fields:()=>scoped<Field[]>({url:'/fields'}),
 growthTrend:(cropId:string,granularity:TrendGranularity)=>scoped<GrowthTrend>({url:'/growth-trend',params:{cropId:cropId||undefined,granularity,detail:true,mode:'size'}}),
 cropSummaries:()=>scoped<CropSummary[]>({url:'/crop-summaries'}),
 detections:(id:string)=>scoped<DetectionResult>({url:'/ridges/'+encodeURIComponent(id)+'/detections'}),
 harvestSummary:()=>scoped<HarvestSummary>({url:'/harvest-summary'}),
 profile:()=>scoped<FarmProfile>({url:'/profile'}),
 crops:()=>scoped<Crop[]>({url:'/crops'}),
 dashboard:(cropId:string)=>scoped<Dashboard>({url:'/dashboard',params:{cropId:cropId||undefined}}),
 ridges:()=>scoped<Page<Ridge>>({url:'/ridges',params:{pageSize:100}}),
 ridge:(id:string)=>scoped<Ridge>({url:'/ridges/'+encodeURIComponent(id)}),
 harvests:(page=1)=>scoped<Page<Harvest>>({url:'/harvests',params:{page,pageSize:10}}),
 harvest:(data:HarvestInput)=>scoped<Harvest>({url:'/harvests',method:'POST',data}),
 plant:(data:PlantInput)=>scoped<Ridge>({url:'/plantings',method:'POST',data}),
 settingsDefaults:()=>scoped<Settings>({url:'/settings/defaults'}),
 settings:()=>scoped<Settings>({url:'/settings'}),
 saveSettings:(data:Settings)=>scoped<Settings>({url:'/settings',method:'PUT',data})
}
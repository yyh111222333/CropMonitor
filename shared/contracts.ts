export interface Envelope<T>{code:number;message:string;data:T;requestId:string;timestamp:string}
export interface Page<T>{items:T[];total:number;page:number;pageSize:number}
export interface CollectionImage{id:string;url:string;title:string;capturedAt:string|null}
export interface Crop{images:CollectionImage[];id:string;name:string;cultivar:string;color:string;intervalDays:number;maturityProfile?:import('./monitoring').MaturityProfile}
export interface Ridge{monitoring?:import('./monitoring').MonitoringValues;id:string;number:number;cropId:string;active:boolean;batch:string;plantedAt:string;plants:number;growthCm:number|null;previousSampledAt:string|null;leafArea:number;fruitCount:number;mature:number;turning:number;immature:number;unknown:number;lesions:number;plantSampleCount:number;leafSampleCount:number;diseasedLeafCount:number;diseasedFruitCount:number;sampledAt:string;quality:string}
export interface RuleSettings{minGrowth:number;maxGrowth:number;inspectionDays:number;leafDiseasePercent:number;fruitDiseasePercent:number;reviewDays:number;maturePercent:number;harvestInspectionDays:number;staleDays:number;minPlantSamples:number;minLeafSamples:number;minFruitSamples:number}
export interface Settings extends RuleSettings{overrides:Record<string,RuleSettings>;updatedAt:string|null}
export interface Harvest{id:string;ridgeId:string;cropId:string;batch:string;date:string;quantity:number;unit:'kg';finish:boolean;note:string}
export interface HarvestInput{ridgeId:string;date:string;quantity:number;finish:boolean;note:string}
export interface PlantInput{ridgeId:string;cropId:string;plants:number;plantedAt:string;batch:string}
export interface Dashboard{plants:number;batches:number;attention:number;harvests:number;fruitTotal:number;stages:{name:string;value:number}[];trend:{label:string;value:number}[];ridges:Ridge[];concerns:Ridge[];updatedAt:string}

export interface CropSummary{cropId:string;activeRidges:number;plants:number;batches:number;averageGrowth:number|null;attentionRidges:number;harvestReadyRidges:number;validFruitCount:number;matureFruitCount:number;totalHarvestKg:number;latestInspectionAt:string|null}

export interface Farm{id:string;name:string}
export interface Field{id:string;name:string}
export interface FarmProfile{farmId:string;fieldId:string;name:string;fieldName:string;operator:string}

export interface DetectionImage extends CollectionImage{target:'leaf'|'fruit';result:'healthy'|'diseased';source:'ai-generated'}
export interface DetectionResult{ridgeId:string;items:DetectionImage[]}
export interface HarvestSummary{today:string;weekStart:string;byCrop:{cropId:string;todayKg:number;weekKg:number;totalKg:number}[];byRidge:{ridgeId:string;batch:string;quantity:number;count:number}[]}

export type TrendGranularity='week'|'month'
export interface GrowthObservation{initialSizeCm?:number|null;ridgeId:string;cropId:string;batch:string;plantedAt:string;date:string;previousDate:string|null;growthCm:number|null;plantSamples:number}
export interface GrowthTrend{basis?:'size';cropId:string;granularity:TrendGranularity;sampling:'day'|'week'|'month';unit:'cm';points:{label:string;periodStart:string;periodEnd:string;sampleCount:number;value:number|null}[]}


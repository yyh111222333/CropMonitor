interface Observation {ridgeId:string;cropId:string;batch:string;plantedAt:string;date:string;previousDate:string|null}
/** Reconstruct measured dimensions from a measured baseline and linked increments. */
export function dimensionValues<T extends Observation>(rows:T[],value:(row:T)=>number|null,baseline:(row:T)=>number|null,usable:(row:T)=>boolean):Map<T,number|null>{
 const result=new Map<T,number|null>(),groups=new Map<string,T[]>()
 for(const row of rows){const key=JSON.stringify([row.ridgeId,row.cropId,row.batch,row.plantedAt]);const group=groups.get(key)??[];group.push(row);groups.set(key,group)}
 for(const group of groups.values()){
  const totals=new Map<string,number>(),dateCounts=new Map<string,number>()
  for(const row of group)dateCounts.set(row.date,(dateCounts.get(row.date)??0)+1)
  for(const row of [...group].sort((a,b)=>a.date.localeCompare(b.date))){
   let total:number|null=null
   if(usable(row)&&row.date>=row.plantedAt&&dateCounts.get(row.date)===1){
    const measured=baseline(row)
    if(measured!==null&&Number.isFinite(measured))total=measured
    else if(row.previousDate!==null&&row.previousDate<row.date&&row.previousDate>=row.plantedAt){
     const previous=totals.get(row.previousDate),increment=value(row)
     if(previous!==undefined&&increment!==null&&Number.isFinite(increment))total=previous+increment
    }
   }
   if(total!==null)totals.set(row.date,total)
   result.set(row,total===null?null:Number(total.toFixed(4)))
  }
 }
 return result
}

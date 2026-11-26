import type {MetricTrend,MonitorPoint} from './monitoring'
const day=86400000
const date=(p:MonitorPoint)=>Date.parse(p.periodEnd)

/** Describe observed direction and phase changes without predicting maturity. */
export function summarizeTrend(metric:MetricTrend):string {
 const points=metric.points.filter(p=>p.value!==null&&Number.isFinite(p.value)&&Number.isFinite(date(p)))
 if(points.length<3)return `${metric.label}有效记录不足，暂不评价趋势`
 // A gap cannot support a continuous growth assessment.
 if(metric.points.some(p=>p.value===null))return `${metric.label}记录存在缺测，暂不能完整判断阶段变化`
 const start=points[0]!,end=points.at(-1)!,change=end.value!-start.value!
 const tolerance=Math.max(Math.abs(start.value!),Math.abs(end.value!),1)*.005
 const direction=change>tolerance?'整体上升':change<-tolerance?'整体下降':'整体平稳'
 if(points.length<7)return `${metric.label}${direction}`
 const third=Math.floor((points.length-1)/3)
 const marks=[0,third,2*third,points.length-1]
 const slopes=marks.slice(1).map((index,i)=>{
  const a=points[marks[i]!]!,b=points[index]!,days=(date(b)-date(a))/day
  return days>0?(b.value!-a.value!)/days:0
 })
 const [early,middle,recent]=slopes as [number,number,number]
 const floor=tolerance/Math.max(1,(date(end)-date(start))/day)
 let phase=''
 if(early>floor&&middle>floor&&middle<early*.75&&recent>middle*1.25)phase='前期增长较快，中期增速放缓，近期恢复增长'
 else if(recent>floor&&middle>floor&&recent>middle*1.25)phase='近期增速加快'
 else if(recent>floor&&middle>floor&&recent<middle*.75)phase='近期仍在增长，但增速放缓'
 else if(recent<-floor)phase='近期出现回落'
 else if(Math.abs(recent)<=floor)phase='近期变化较小'
 else if(early>floor&&middle>floor&&recent>floor)phase='各阶段持续增长'
 return `${metric.label}${direction}${phase?'，'+phase:''}`
}

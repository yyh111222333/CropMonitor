import {test} from 'node:test'
import assert from 'node:assert/strict'
import {summarizeTrend} from '../shared/trendSummary'
const metric=(values:(number|null)[])=>({key:'stem',label:'茎干长势',unit:'cm',points:values.map((value,i)=>({label:'',periodStart:`2026-11-${String(i+1).padStart(2,'0')}`,periodEnd:`2026-11-${String(i+1).padStart(2,'0')}`,value,sampleCount:10}))})
test('trend summary describes slowdown and recovery from observed phases',()=>{
 assert.match(summarizeTrend(metric([0,1,2,3,3.2,3.4,3.6,4.6,5.6,6.6])),/中期增速放缓，近期恢复增长/)
 assert.match(summarizeTrend(metric([9,8,7,6,5,4,3,2,1,0])),/整体下降.*近期出现回落/)
 assert.match(summarizeTrend(metric([2,2,2,2,2,2,2,2,2,2])),/整体平稳/)
})
test('missing or insufficient observations do not produce confident growth or maturity predictions',()=>{
 assert.match(summarizeTrend(metric([1,null,3,4])),/缺测/)
 assert.match(summarizeTrend(metric([1,2])),/不足/)
 assert.doesNotMatch(summarizeTrend(metric([1,2,3,4,5,6,7,8,9])),/预计|成熟|良好/)
})

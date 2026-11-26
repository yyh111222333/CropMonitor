<script setup lang="ts">
import {computed} from 'vue'
import ChartPanel from './ChartPanel.vue'
import {summarizeTrend} from '../../shared/trendSummary'
import type {MetricTrend} from '../../shared/monitoring'
const props=defineProps<{metric:MetricTrend}>()
const valid=computed(()=>props.metric.points.filter(p=>p.value!==null))
const evaluation=computed(()=>summarizeTrend(props.metric)+'。')
const option=computed(()=>({color:['#139e7c'],textStyle:{fontFamily:'Microsoft YaHei, sans-serif'},tooltip:{trigger:'axis',valueFormatter:(v:unknown)=>typeof v==='number'?v+' '+props.metric.unit:'暂无数据'},grid:{left:56,right:22,top:32,bottom:40},xAxis:{type:'category',boundaryGap:false,data:props.metric.points.map(p=>p.periodStart===p.periodEnd?p.periodStart:p.periodStart+' 至 '+p.periodEnd),axisLabel:{hideOverlap:true,interval:Math.max(0,Math.ceil(props.metric.points.length/6)-1),formatter:(s:string)=>s.slice(5,10).replace('-','/'),color:'#64786b'},axisLine:{lineStyle:{color:'#dfe8e4'}}},yAxis:{type:'value',name:props.metric.key==='stem'?'高度（cm）':props.metric.key==='leafGrowth'?'面积（cm²）':props.metric.unit,axisLabel:{color:'#64786b'},splitLine:{lineStyle:{color:'#edf1ef'}}},series:[{name:props.metric.label,type:'line',data:props.metric.points.map(p=>p.value),connectNulls:false,smooth:false,symbolSize:4,areaStyle:{color:'#dbf4ea',opacity:.7},lineStyle:{width:2.5}}]}))
</script>
<template><article class="monitor-chart"><h3>{{metric.label}}</h3><ChartPanel v-if="valid.length" :option="option" :label="metric.label+'，单位'+metric.unit"/><div v-else class="chart empty">暂无有效检测数据</div><p v-if="valid.length" class="trend-caption">{{valid[0]?.periodStart}} 至 {{valid.at(-1)?.periodEnd}} · {{valid.length}} 个有效数据点</p><p class="trend-evaluation"><b>评价：</b>{{evaluation}}</p></article></template>

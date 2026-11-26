<script setup lang="ts">
import {computed} from 'vue'
import {summarizeTrend} from '../../shared/trendSummary'
import {useFarm} from '../stores/farm'
import MetricTrend from './MetricTrend.vue'
import HarvestMonitor from './HarvestMonitor.vue'
const farm=useFarm()
const crop=computed(()=>farm.crops.find(c=>c.id===farm.cropId))
const stem=computed(()=>({key:'stem',label:'茎干长势',basis:'size' as const,unit:'cm',points:farm.growthTrend?.points??[]}))
const metrics=computed(()=>[
 {...stem.value},
 {key:'leafGrowth',label:'叶片长势',basis:'size' as const,unit:'cm²',points:farm.monitoringTrend?.series.find(s=>s.key==='leafGrowth')?.points??[]},
 ...(farm.monitoringTrend?.series.filter(s=>s.key!=='leafGrowth'&&s.key!=='leafArea')??[])
])
const growthReview=computed(()=>{
 const ready=(farm.dashboard?.ridges??[]).filter(r=>farm.harvestAssessment(r)?.ready).length
 const stemSummary=summarizeTrend(stem.value),leafSummary=summarizeTrend(metrics.value[1]!)
 return `总体评价：${stemSummary}；${leafSummary}；${ready?`当前 ${ready} 垄达到综合采收参考`:'当前尚无田垄达到综合采收参考'}。`
})
const firstConcern=computed(()=>farm.dashboard?.concerns[0])
</script>
<template>
 <section class="panel monitoring-section unified-growth">
  <div class="panel-title">
   <div><h2>生长状态</h2><p>{{crop?.maturityProfile?.kind==='leafy'?'茎干、叶片与叶菜采收指标':'茎干、叶片与果实指标'}} · 统一查看生长与采收状态</p></div>
   <div class="growth-actions">
    <RouterLink to="/management" class="text-link">登记采收</RouterLink>
    <div class="trend-switch" role="group" aria-label="生长趋势统计周期">
     <button :class="{active:farm.trendGranularity==='week'}" :aria-pressed="farm.trendGranularity==='week'" @click="farm.setTrendGranularity('week')">按周</button>
     <button :class="{active:farm.trendGranularity==='month'}" :aria-pressed="farm.trendGranularity==='month'" @click="farm.setTrendGranularity('month')">按月</button>
    </div>
   </div>
  </div>
  <p class="muted monitor-note">{{farm.trendGranularity==='week'?'近 6 周，按日展示':'近 6 个月，按周展示'}}。茎干曲线记录关键点在小车坐标系下的高度，首次测量后逐次叠加生长量；叶片曲线记录面积；按月查看时，每周取末次有效尺寸。缺测时保留空缺。</p>
  <p v-if="farm.trendLoading" class="empty" role="status">正在加载生长指标…</p>
  <div v-else-if="farm.trendError" class="error-banner" role="alert">{{farm.trendError}} <button @click="farm.refreshGrowthTrend">重试</button></div>
  <template v-else-if="farm.cropId">
   <div class="growth-metrics-grid">
    <MetricTrend v-for="metric in metrics" :key="metric.key" :metric="metric" />
    <HarvestMonitor/>
   </div>
   <p v-if="growthReview" class="growth-review">{{growthReview}}</p>
   <p class="trend-caption">当前为模拟巡检和示例参考规则。尺寸按有效样本加权；{{crop?.maturityProfile?.kind==='leafy'?'叶片面积、植株宽度与叶色按对应有效样本加权。':'果径和色泽按有效果实数加权，果实数量为每日总数（按月查看时取周内日均值），不直接计入成熟评分。'}}</p>
  </template>
  <p v-else class="empty">请选择一种作物查看生长与采收指标</p>
  <div class="insight"><span>{{farm.dashboard?.attention?farm.dashboard.attention+' 垄需要关注，可查看异常描述、照片和处理记录':'当前没有规则触发的异常'}}</span><RouterLink v-if="firstConcern" :to="{path:'/ridges',query:{id:firstConcern.id,tab:'issues'}}">查看异常</RouterLink></div>
 </section>
</template>

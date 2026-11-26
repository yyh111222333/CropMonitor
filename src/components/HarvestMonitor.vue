<script setup lang="ts">
import {computed} from 'vue'
import {useFarm} from '../stores/farm'
const farm=useFarm()
const crop=computed(()=>farm.crops.find(c=>c.id===farm.cropId))
const evaluations=computed(()=>(farm.dashboard?.ridges??[]).map(r=>farm.harvestAssessment(r)))
const ready=computed(()=>evaluations.value.filter(e=>e?.ready).length)
const pending=computed(()=>evaluations.value.filter(e=>e?.score==null).length)
</script>
<template>
 <article class="growth-assessment">
  <h3>综合采收评价</h3>
  <div class="growth-readiness">
   <div><strong>{{ready}}<small> 垄</small></strong><span>达到采收参考</span></div>
   <div><strong>{{pending}}<small> 垄</small></strong><span>必要数据待补齐</span></div>
  </div>
  <p>{{crop?.maturityProfile?.kind==='leafy'?'结合叶色、叶片面积与植株尺寸':'结合果实大小与色泽'}}，按作物档案中启用的指标和权重综合评价。</p>
  <p>满分 100 分，达到 {{crop?.maturityProfile?.readyScore??85}} 分触发采收参考提醒。</p>
  <RouterLink to="/crops" class="text-link">查看与配置成熟指标 →</RouterLink>
  <p class="trend-caption">各田垄的评分明细可在田垄地图中查看。</p>
 </article>
</template>

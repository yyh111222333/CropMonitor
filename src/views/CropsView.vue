<script setup lang="ts">
import MaturityRules from '../components/MaturityRules.vue'
import FieldSelector from '../components/FieldSelector.vue'
import {computed} from 'vue'
import {useFarm} from '../stores/farm'
import {ArrowUpRight,MapPin,Sprout,ShoppingBasket} from 'lucide-vue-next'
import {useRouter} from 'vue-router'
import CollectionPhoto from '../components/CollectionPhoto.vue'
const farm=useFarm(),router=useRouter()
const cards=computed(()=>farm.crops.map(c=>({crop:c,stats:farm.cropSummaries.find(s=>s.cropId===c.id)})))
async function show(id:string){farm.cropId=id;await farm.refresh();router.push('/')}
const percent=(mature:number,total:number)=>total?Math.round(mature/total*100):0
</script>
<template>
 <div class="filters"><FieldSelector/></div><div class="two-col crop-archives">
  <section v-for="{crop:c,stats:s} in cards" :key="c.id" class="panel crop-card">
   <CollectionPhoto v-for="photo in c.images" :key="photo.id" :photo="photo"/>
   <p v-if="!c.images?.length" class="empty">暂无采集照片</p>
   <div class="panel-title"><div><h2>{{c.name}}</h2><p>{{c.cultivar}}</p></div><span class="pill">{{s?.activeRidges?'在种档案':'暂无在种批次'}}</span></div>
   <template v-if="s">
    <div class="crop-stat-grid">
     <div><span><MapPin :size="18"/>在种田垄</span><strong>{{s.activeRidges}}<small>垄</small></strong></div>
     <div><span><Sprout :size="18"/>登记苗数</span><strong>{{s.plants.toLocaleString()}}<small>株</small></strong></div>
     <div><span><ShoppingBasket :size="18"/>累计采收</span><strong>{{s.totalHarvestKg}}<small>kg</small></strong></div>
    </div>
    <div class="crop-detail-grid">
     <section><h3>生长与健康</h3><dl><div><dt>平均增长幅度</dt><dd>{{s.averageGrowth==null?'待对比检测':(s.averageGrowth>0?'+':'')+s.averageGrowth+' cm'}}</dd></div><div><dt>比较基准</dt><dd>上一次有效检测</dd></div><div><dt>异常区域</dt><dd><RouterLink :to="'/ridges?crop='+c.id" :class="{'crop-alert':s.attentionRidges>0}">{{s.attentionRidges}} 垄 →</RouterLink></dd></div></dl></section>
     <section><h3>收获监测</h3><template v-if="c.maturityProfile?.kind!=='leafy'"><div class="crop-maturity-value"><strong>{{s.validFruitCount?percent(s.matureFruitCount,s.validFruitCount)+'%':'—'}}</strong><span>成熟果占比</span></div><div class="progress-track"><i :style="{width:percent(s.matureFruitCount,s.validFruitCount)+'%'}"/></div><p class="muted crop-fruit-count">{{s.validFruitCount?s.matureFruitCount+' / '+s.validFruitCount+' 个有效果实':'暂无有效果实检测'}}</p></template><p v-else class="muted crop-fruit-count">按叶色、叶片面积与植株尺寸综合评价</p><div class="crop-harvest-count"><span>综合采收参考</span><b>{{s.harvestReadyRidges}} 垄</b></div></section>
    </div>
    <dl class="crop-meta"><div><dt>在种批次</dt><dd>{{s.batches}} 批</dd></div><div><dt>常规巡检间隔</dt><dd>{{c.intervalDays}} 天</dd></div><div><dt>最近巡检</dt><dd>{{s.latestInspectionAt?new Date(s.latestInspectionAt).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'暂无巡检'}}</dd></div></dl>
   </template><p v-else class="empty">正在加载作物统计…</p>
   <MaturityRules :crop="c"/><div class="crop-actions"><button class="primary" @click="show(c.id)">查看生长趋势 <ArrowUpRight :size="18"/></button><RouterLink :to="'/ridges?crop='+c.id" class="secondary">查看田垄 <MapPin :size="18"/></RouterLink></div>
  </section>
 </div>
</template>

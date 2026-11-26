<script setup lang="ts">

import FieldSelector from '../components/FieldSelector.vue'

import GrowthHealth from '../components/GrowthHealth.vue'



import {computed} from 'vue'

import {Sprout,Layers,TriangleAlert,ShoppingBasket} from 'lucide-vue-next'

import {useFarm} from '../stores/farm'

import CollectionPhoto from '../components/CollectionPhoto.vue'

const farm=useFarm(),d=computed(()=>farm.dashboard)

const metrics=computed(()=>[{label:'登记在种苗数',value:d.value?.plants,unit:'株',icon:Sprout},{label:'在种批次',value:d.value?.batches,unit:'批',icon:Layers},{label:'异常区域',value:d.value?.attention,unit:'垄',icon:TriangleAlert},{label:'采收记录',value:d.value?.harvests,unit:'条',icon:ShoppingBasket}])

const ranked=computed(()=>(d.value?.ridges||[]).filter(r=>r.active).map(r=>({ridge:r,maturity:farm.harvestAssessment(r)?.score??null})).sort((a,b)=>(b.maturity??-1)-(a.maturity??-1)||a.ridge.number-b.ridge.number))

</script><template><template v-if="d"><div class="filters"><FieldSelector/><select v-model="farm.cropId" aria-label="筛选作物" @change="farm.refresh"><option value="">全部作物</option><option v-for="c in farm.crops" :value="c.id" :key="c.id">{{c.name}} · {{c.cultivar}}</option></select><span class="period">生长趋势 · {{farm.trendGranularity==='week'?'近6周':'近6个月'}}</span><small class="push">更新于 {{new Date(d.updatedAt).toLocaleTimeString('zh-CN')}}</small></div><div class="metric-grid"><article class="metric" v-for="m in metrics" :key="m.label"><div class="metric-top"><span>{{m.label}}</span><span class="metric-icon"><component :is="m.icon" :size="21"/></span></div><strong>{{m.value?.toLocaleString()}}<small>{{m.unit}}</small></strong></article></div><GrowthHealth/><div class="two-col lower"><section class="panel ridge-progress-panel"><div class="panel-title"><div><h2>分垄综合成熟评价</h2><p>全部 {{ranked.length}} 条在种田垄 · 按综合参考评分排序</p></div><RouterLink to="/ridges" class="text-link">田垄地图 →</RouterLink></div><div v-if="ranked.length" class="progress-heading"><span>田垄</span><span>综合参考评分</span><span>评价结果</span></div><div class="ridge-progress-list" tabindex="0" role="region" aria-label="全部在种田垄成熟进度，可滚动查看"><RouterLink v-for="{ridge:r,maturity} in ranked" :key="r.id" :to="'/ridges?id='+r.id" class="progress-row"><span>{{r.number}}垄</span><div class="progress-track"><i :style="{width:(maturity??0)+'%'}"/></div><b>{{maturity===null?'—':Math.round(maturity)+'分'}}</b><small>{{farm.harvestAssessment(r)?.label??'待检测'}}</small></RouterLink></div><p v-if="!ranked.length" class="empty">当前范围暂无在种田垄</p></section><section class="panel collection-panel"><div class="panel-title"><h2>田间采集影像</h2><RouterLink to="/crops" class="text-link">作物档案 →</RouterLink></div><template v-for="crop in farm.crops.filter(c=>!farm.cropId||c.id===farm.cropId)" :key="crop.id"><CollectionPhoto v-for="photo in crop.images" :key="photo.id" :photo="photo"/><p v-if="!crop.images?.length" class="empty">{{crop.name}}暂无采集照片</p></template></section></div><section class="panel"><div class="panel-title"><h2><TriangleAlert :size="20"/>需要处理 <span class="count">{{d.concerns.length}}</span></h2><RouterLink to="/ridges" class="text-link">全部田垄 →</RouterLink></div><div class="table-wrap"><table><thead><tr><th>田垄</th><th>作物品种</th><th>关注事项</th><th>较上次增长</th><th>操作</th></tr></thead><tbody><tr v-for="r in d.concerns" :key="r.id"><td><b>{{r.number}}号垄</b></td><td>{{farm.cropName(r.cropId)}}</td><td><span class="badge warning">{{farm.assessment(r)?.issues.join(' · ')||farm.status(r)}}</span></td><td>{{r.growthCm==null?'—':(r.growthCm>0?'+':'')+r.growthCm+' cm'}}</td><td><RouterLink :to="'/ridges?id='+r.id+'&tab=issues'" class="text-link">异常详情 →</RouterLink></td></tr></tbody></table><div v-if="!d.concerns.length" class="empty">当前范围暂无待处理事项</div></div></section></template></template>
<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue'
import {onBeforeRouteLeave} from 'vue-router'
import {Sprout,ShieldCheck,ShoppingBasket,CalendarClock} from 'lucide-vue-next'
import {useFarm} from '../stores/farm'
import {cropApi} from '../api/crop'
import type {RuleSettings,Settings} from '../../shared/contracts'
import {validateRules} from '../../shared/rules'
const farm=useFarm(),draft=ref<Settings>(),defaults=ref<Settings>(),baseline=ref(''),scope=ref(''),busy=ref(false),error=ref(''),message=ref('')
const copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value))
watch(()=>farm.settings,s=>{if(s&&!draft.value){draft.value=copy(s);baseline.value=JSON.stringify(s)}},{immediate:true})
onMounted(async()=>{try{defaults.value=await cropApi.settingsDefaults()}catch(e){error.value=(e as Error).message}})
const custom=computed(()=>!!scope.value&&!!draft.value?.overrides[scope.value])
const current=computed(()=>draft.value?(draft.value.overrides[scope.value]??draft.value):undefined)
const dirty=computed(()=>!!draft.value&&JSON.stringify(draft.value)!==baseline.value)
const editable=computed(()=>!scope.value||custom.value)
function rulesOnly(s:Settings):RuleSettings{const {overrides,updatedAt,...rules}=s;return rules}
function toggleCustom(event:Event){if(!draft.value)return;if((event.target as HTMLInputElement).checked)draft.value.overrides[scope.value]=copy(rulesOnly(draft.value));else delete draft.value.overrides[scope.value];message.value=''}
function reset(){if(!draft.value||!defaults.value)return;const rules=copy(rulesOnly(defaults.value));if(scope.value)draft.value.overrides[scope.value]=rules;else Object.assign(draft.value,rules);message.value='已填入默认值，保存后生效';error.value=''}
function cancel(){if(farm.settings){draft.value=copy(farm.settings);baseline.value=JSON.stringify(farm.settings)}error.value='';message.value='已撤销未保存的修改'}
async function save(){if(!draft.value)return;error.value='';message.value='';const problems=[validateRules(draft.value),...Object.entries(draft.value.overrides).map(([id,r])=>{const e=validateRules(r);return e?farm.cropName(id)+'：'+e:null})].filter(Boolean);if(problems.length){error.value=problems[0]!;return}busy.value=true;try{const saved=await cropApi.saveSettings(copy(draft.value));draft.value=copy(saved);baseline.value=JSON.stringify(saved);farm.settings=saved;await farm.refresh();message.value=farm.error?'设置已保存，页面数据刷新失败，请点击刷新数据':'设置已保存，评价与提醒已更新'}catch(e){error.value=(e as Error).message}finally{busy.value=false}}
onBeforeRouteLeave(()=>!dirty.value||window.confirm('有尚未保存的参数，确定离开吗？'))
type Field={key:keyof RuleSettings;label:string;unit:string;min:number;max:number;step:number}
const groups:{title:string;icon:typeof Sprout;hint:string;fields:Field[]}[]=[
 {title:'生长评价',icon:Sprout,hint:'比较本次与上次检测的增长量；低于下限为偏慢，高于上限为偏快。',fields:[{key:'minGrowth',label:'单次增长幅度下限',unit:'cm',min:0,max:100,step:0.1},{key:'maxGrowth',label:'单次增长幅度上限',unit:'cm',min:0.1,max:100,step:0.1},{key:'minPlantSamples',label:'最低有效植株数',unit:'株',min:1,max:10000,step:1}]},
 {title:'健康检测',icon:ShieldCheck,hint:'病叶、病果分别按有效检测数量计算比例；发现病斑仍保留复核提醒。',fields:[{key:'leafDiseasePercent',label:'病叶比例提醒阈值',unit:'%',min:0.1,max:100,step:0.1},{key:'fruitDiseasePercent',label:'病果比例提醒阈值',unit:'%',min:0.1,max:100,step:0.1},{key:'reviewDays',label:'检测后复核期限',unit:'天',min:1,max:30,step:1},{key:'minLeafSamples',label:'最低有效叶片数',unit:'片',min:1,max:10000,step:1}]},
 {title:'收获监测',icon:ShoppingBasket,hint:'作物档案配置色泽、大小等成熟标志及综合提醒分值；此处配置采收期巡检间隔和样本要求。',fields:[{key:'harvestInspectionDays',label:'采收期巡检间隔',unit:'天',min:1,max:30,step:1},{key:'minFruitSamples',label:'最低有效果实数',unit:'个',min:1,max:10000,step:1}]},
 {title:'巡检与数据',icon:CalendarClock,hint:'过期或样本不足的数据不参与对应评价。',fields:[{key:'inspectionDays',label:'常规巡检间隔',unit:'天',min:1,max:30,step:1},{key:'staleDays',label:'巡检数据有效期',unit:'天',min:1,max:30,step:1}]}
]
</script>
<template>
 <div class="settings-page" v-if="draft&&current">
  <section class="panel settings-scope">
   <label>适用范围<select v-model="scope" :disabled="busy"><option value="">全部作物 · 通用规则</option><option v-for="c in farm.crops" :key="c.id" :value="c.id">{{c.name}} · {{c.cultivar}}</option></select></label>
   <label v-if="scope" class="checkbox"><input type="checkbox" :checked="custom" :disabled="busy" @change="toggleCustom"/>使用独立规则</label>
   <span class="badge">{{scope?(custom?'独立配置':'继承通用规则'):'通用配置'}}</span>
   <span class="muted settings-update">{{draft.updatedAt?'上次保存 '+new Date(draft.updatedAt).toLocaleString('zh-CN'):'尚未修改'}}</span>
  </section>
  <form @submit.prevent="save">
   <div class="settings-grid">
    <section class="panel rule-card" v-for="group in groups" :key="group.title">
     <h2><component :is="group.icon" :size="24"/>{{group.title}}</h2><p class="muted">{{group.hint}}</p>
     <fieldset :disabled="busy||!editable"><div class="rule-fields"><label v-for="f in group.fields" :key="f.key">{{f.label}}<div class="unit-input"><input type="number" v-model.number="current[f.key]" :min="f.min" :max="f.max" :step="f.step" required/><span>{{f.unit}}</span></div></label></div></fieldset>
    </section>
   </div>
   <div class="panel settings-actions"><p v-if="error" class="error-banner" role="alert">{{error}}</p><p v-if="message" class="success" role="status">{{message}}</p><span role="status" class="muted">{{dirty?'有未保存的修改':'全部修改已保存'}}</span><button type="button" class="secondary" :disabled="busy||!defaults" @click="reset">恢复当前范围默认值</button><button type="button" class="secondary" :disabled="busy||!dirty" @click="cancel">撤销修改</button><button class="primary" :disabled="busy||!dirty">{{busy?'保存中…':'保存设置'}}</button></div>
  </form>
 </div><div v-else class="panel empty">正在加载参数…</div>
</template>

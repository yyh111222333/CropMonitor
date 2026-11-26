<script setup lang="ts">
import {ref,watch} from 'vue'
import {cropApi} from '../api/crop'
import type {DetectionImage} from '../../shared/contracts'
import CollectionPhoto from './CollectionPhoto.vue'
const props=defineProps<{ridgeId:string;updatedAt?:string}>()
const images=ref<DetectionImage[]>([]),loading=ref(false),error=ref('');let version=0
async function load(){const v=++version;loading.value=true;error.value='';images.value=[];try{const data=await cropApi.detections(props.ridgeId);if(v===version)images.value=data.items}catch(e){if(v===version)error.value=(e as Error).message}finally{if(v===version)loading.value=false}}
watch(()=>[props.ridgeId,props.updatedAt],load,{immediate:true})
</script><template><section class="ridge-detection"><div class="panel-title"><h2>健康检测</h2></div><p v-if="loading" class="muted" role="status">正在加载检测图片…</p><p v-else-if="error" class="error-banner">{{error}} <button @click="load">重试</button></p><template v-else-if="images.length"><article v-for="item in images" :key="item.id"><div class="detection-status"><strong>{{item.target==='leaf'?'叶片':'果实'}}检测</strong><span class="badge" :class="{warning:item.result==='diseased'}">{{item.result==='diseased'?'有病 · 待复核':'无病 · 未见病斑'}}</span></div><CollectionPhoto :photo="item"/></article></template><p v-else class="muted">暂无本批次检测记录</p></section></template>

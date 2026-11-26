<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {Expand,X,Camera} from 'lucide-vue-next'
import type {CollectionImage} from '../../shared/contracts'
import {http} from '../api/http'
const props=defineProps<{photo:CollectionImage}>()
const dialog=ref<HTMLDialogElement|null>(null),failed=ref(false)
const source=computed(()=>{
 const base=new URL(http.defaults.baseURL||'/api',window.location.origin)
 const url=new URL(props.photo.url,base.href.endsWith('/')?base.href:base.href+'/')
 return ['http:','https:'].includes(url.protocol)?url.href:''
})
watch(()=>props.photo.url,()=>{failed.value=false;dialog.value?.close()})
function open(){dialog.value?.showModal()}
</script>
<template>
<figure class="collection-photo">
 <button v-if="!failed&&source" class="photo-trigger" @click="open" :aria-label="'查看原图：'+photo.title">
  <img :src="source" :alt="photo.title" loading="lazy" @error="failed=true"/>
  <span class="photo-expand"><Expand :size="20"/> 查看原图</span>
 </button>
 <div v-else class="photo-unavailable"><Camera :size="30"/><span>图片暂时无法加载</span><button class="secondary" @click="failed=false">重新加载</button></div>
 <figcaption><span>{{photo.title}}</span><time v-if="photo.capturedAt">{{new Date(photo.capturedAt).toLocaleString('zh-CN')}}</time></figcaption>
</figure>
<Teleport to="body"><dialog ref="dialog" class="photo-dialog" :aria-label="photo.title" @click="e=>{if(e.target===dialog)dialog?.close()}">
 <div class="photo-dialog-heading"><strong>{{photo.title}}</strong><button autofocus class="secondary" @click="dialog?.close()" aria-label="关闭原图"><X :size="24"/>关闭</button></div>
 <img :src="source" :alt="photo.title"/>
</dialog></Teleport>
</template>

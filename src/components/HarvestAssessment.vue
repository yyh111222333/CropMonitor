<script setup lang="ts">
import {computed} from 'vue'
import {useFarm} from '../stores/farm'
import type {Ridge} from '../../shared/contracts'
const props=defineProps<{ridge:Ridge}>(),farm=useFarm()
const evaluation=computed(()=>farm.harvestAssessment(props.ridge))
</script>
<template><section v-if="ridge.active&&evaluation" class="ridge-fruit-summary"><div class="panel-title"><h3>综合成熟评价</h3><span class="badge" :class="{'harvest-badge':evaluation.ready}">{{evaluation.label}}</span></div><div class="ridge-fruit-total"><strong>{{evaluation.score??'—'}}<small v-if="evaluation.score!==null"> 分</small></strong><span v-if="evaluation.reason">{{evaluation.reason}}</span></div><dl class="factor-details"><div v-for="f in evaluation.factors" :key="f.key"><dt>{{f.label}}<small>目标 {{f.target}} {{f.unit}} · 相对权重 {{f.weight}}</small></dt><dd>{{f.value===null?'待检测':f.value+' '+f.unit}}<small>达成 {{f.attainment===null?'—':Math.round(f.attainment)+'%'}}</small></dd></div></dl><p class="trend-caption">按作物档案中的成熟标志综合评价。{{farm.assessment(ridge)?.issues.length?'当前有健康或数据异常，请同时查看异常详情。':''}}</p><RouterLink to="/crops" class="text-link">查看成熟指标规则</RouterLink></section></template>

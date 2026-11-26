<script setup lang="ts">
import {useFarm} from '../stores/farm'
defineProps<{disabled?:boolean}>()
const farm=useFarm()
</script>
<template><div class="field-selector"><select class="farm-select" aria-label="选择农场" :value="farm.farmId" :disabled="disabled||farm.loading" @change="farm.selectFarm(($event.target as HTMLSelectElement).value)"><option v-for="item in farm.farms" :key="item.id" :value="item.id">{{item.name}}</option></select><select aria-label="选择田块" :value="farm.fieldId" :disabled="disabled||farm.loading" @change="farm.selectField(($event.target as HTMLSelectElement).value)"><option v-for="field in farm.fields" :key="field.id" :value="field.id">{{field.name}}</option></select></div></template>

<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount,watch} from 'vue'
import * as echarts from 'echarts/core'
import {LineChart,PieChart} from 'echarts/charts'
import {GridComponent,TooltipComponent,LegendComponent} from 'echarts/components'
import {CanvasRenderer} from 'echarts/renderers'
import type {EChartsCoreOption} from 'echarts/core'
echarts.use([LineChart,PieChart,GridComponent,TooltipComponent,LegendComponent,CanvasRenderer])
const props=defineProps<{option:EChartsCoreOption;label:string}>(),el=ref<HTMLDivElement>();let chart:echarts.ECharts|undefined,observer:ResizeObserver|undefined
onMounted(()=>{chart=echarts.init(el.value!);chart.setOption(props.option);observer=new ResizeObserver(()=>chart?.resize());observer.observe(el.value!)})
watch(()=>props.option,v=>chart?.setOption(v,true),{deep:true})
onBeforeUnmount(()=>{observer?.disconnect();chart?.dispose()})
</script><template><div ref="el" class="chart" role="img" :aria-label="label"></div></template>
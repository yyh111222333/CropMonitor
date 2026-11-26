import {createRouter,createWebHistory} from 'vue-router'
export default createRouter({history:createWebHistory(),routes:[
{path:'/',component:()=>import('../views/DashboardView.vue'),meta:{title:'工作台'}},
{path:'/crops',component:()=>import('../views/CropsView.vue'),meta:{title:'作物档案'}},
{path:'/ridges',component:()=>import('../views/RidgesView.vue'),meta:{title:'田垄地图'}},
{path:'/management',component:()=>import('../views/ManagementView.vue'),meta:{title:'种植与采收'}},
{path:'/settings',component:()=>import('../views/SettingsView.vue'),meta:{title:'参数设置'}},
{path:'/:pathMatch(.*)*',component:()=>import('../views/NotFound.vue'),meta:{title:'页面不存在'}}
],scrollBehavior:()=>({top:0})})
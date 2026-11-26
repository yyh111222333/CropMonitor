import {createDatabase} from './db'
import {loadMonitoringState,saveMonitoringState} from './monitoringStorage'
import {fileURLToPath} from 'node:url'
import {createMockServer} from './app'
const database=createDatabase()
const statePath=process.env.MONITORING_STATE_PATH||fileURLToPath(new URL('./.local/monitoring.json',import.meta.url))
loadMonitoringState(statePath,database)
const port=Number(process.env.MOCK_PORT||3001),server=createMockServer(database,250,state=>saveMonitoringState(statePath,state))
server.on('error',e=>{console.error('Mock服务启动失败:',e.message);process.exit(1)})
server.listen(port,'127.0.0.1',()=>console.log('Mock API: http://127.0.0.1:'+port+'/api（巡检为模拟数据；成熟指标与处理记录保存到本地）'))
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>server.close(()=>process.exit(0)))

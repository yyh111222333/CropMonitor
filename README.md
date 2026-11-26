# Crop_Monitoring_Platform

Vue 3 + Vite + TypeScript + Vue Router + Pinia + Axios 农业作物生长监测与管理平台。包含工作台、作物档案、田垄地图、种植与采收、参数设置。ECharts 绘制生长趋势与成熟度分布，响应式布局支持普通电脑和窄屏。

## 运行

建议 Node.js 22.12+（或更新的偶数 LTS）。

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:5173 。命令同时启动 Vite 和独立 Mock HTTP 服务（127.0.0.1:3001）。
也可用 pnpm install / pnpm dev；仓库提供 pnpm-lock.yaml。

```bash
npm run typecheck
npm test
npm run build
```

构建后预览：一个终端运行 npm run mock，另一个运行 npm run preview，打开输出地址。
仅启动静态预览而不运行 Mock 时，接口无法返回数据，页面会提示连接错误。

## 数据流与目录

```text
页面 → Pinia actions / API模块 → Axios → /api → HTTP服务
src/api/           Axios实例、错误转换、统一响应解包、业务请求
src/stores/        Pinia状态及异步加载，防止旧请求覆盖新筛选
src/views/         路由页面，无导入Mock，无业务假数据数组
src/components/    ECharts生命周期封装
src/router/        懒加载路由、404、history模式
shared/            TypeScript接口契约
mock/db.ts         可重复种子的程序生成器
mock/app.ts        HTTP路由、服务端校验、统计聚合
mock/server.ts     服务启动入口
tests/             真实HTTP集成测试
```

静态导航、文案、筛选标签是界面配置；田垄、作物、统计、曲线、成熟比例、记录和参数均由 API 返回。
数字从种子随机算法生成；种植与采收写入独立服务的内存数据库。刷新页面保留，重启 Mock 重置。
Mock 绑定本机、仅用于开发，不含真实鉴权，不是生产后端。

## 切换真实后端

1. 保持 docs/API.md 中接口契约与返回格式；在 .env.real.local 设置 VITE_API_TARGET=http://你的后端:端口。
2. 运行 npm run dev:real，仅启动前端，通过 Vite /api 代理到真实后端，不启动 Mock。
3. 如需直接请求跨域地址，设置 VITE_API_BASE_URL 为完整 API 地址，并由后端配置 CORS。
4. 生产环境默认请求同源 /api，由反向代理转发到后端；VITE_API_TARGET 仅作用于开发/预览代理。
5. 若真实响应结构不同，只修改 src/api/http.ts 的解包或 src/api/crop.ts 的映射，页面无需改造。
6. 登录令牌后续接入 Axios 请求拦截器；不要把私密密钥写入 VITE_ 变量（这些会公开在浏览器中）。
7. history 路由部署需把非文件且非 /api 请求回退到 index.html。

.env.production 不会自动启用真实后端鉴权；真正上线仍需后端提供权限校验、存储和事务。
Mock 不参与 Vite 依赖图，不会打入 dist。

## 当前实现边界

- 32条田垄为示意布局，实际坐标接口可替换布局组件。
- 全部作物时不绘制混合作物增长量；选择品种后按样本数加权聚合。
- 新种植批次处于待首次巡检，不把零值当作长势偏慢；Mock 重置前不会自动生成后续巡检。
- 采收结束将当前田垄变为空垄，历史采收记录保留原品种与批次。
- 设置中的参考阈值为演示规则，需按真实作物和生育阶段扩展；当前只用下限触发偏慢关注。
- 作物、田地与账户资料为演示范围；未实现真实登录、图片标注、权限和历史巡检数据库。
- 表单有重复点击防护，正式后端仍应增加幂等键、版本校验和事务。

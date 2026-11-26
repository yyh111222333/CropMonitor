# API 契约

基础路径 /api，JSON 编码。成功 HTTP 200，创建 HTTP 201；错误使用真实 HTTP 状态。所有响应包含：

```json
{"code":0,"message":"success","data":{},"requestId":"uuid","timestamp":"ISO 8601 UTC"}
```

失败 code 为 HTTP 状态码，data 为 null。400 无效参数/JSON，404不存在，409状态冲突，422字段验证，413请求过大，500内部错误。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /profile | 农场名称、田地名称、操作人 |
| GET | /crops | 作物品种数组 |
| GET | /dashboard?cropId=tomato | 筛选范围内统计、趋势、成熟度、待关注田垄；不传为全部 |
| GET | /ridges?cropId=tomato&page=1&pageSize=10 | 田垄分页，pageSize最大100 |
| GET | /ridges/:id | 单垄详情 |
| GET | /harvests?page=1&pageSize=10 | 采收记录分页，可选cropId |
| POST | /harvests | 新增采收；finish决定是否结束种植 |
| POST | /plantings | 对空垄新增种植批次 |
| GET | /settings | 读取参数 |
| PUT | /settings | 校验并更新参数 |

分页 data: {items:[],total:32,page:1,pageSize:10}。数值字段是JSON number，不是带单位字符串；单位由字段契约确定。
完整返回对象类型见 shared/contracts.ts。

## 写入示例

POST /harvests:
```json
{"ridgeId":"ridge-1","date":"2026-11-16","quantity":12.5,"finish":false,"note":"分批采收"}
```

重量单位 kg；必须大于0；日期不得晚于今天或早于种植日期；note最多500字；结束后的田垄再次采收返回409。

POST /plantings:
```json
{"ridgeId":"ridge-4","cropId":"tomato","plants":40,"plantedAt":"2026-11-16","batch":"冬季第一批"}
```

苗数1至10000整数；批次名1至60字符；日期不得晚于今天；已在种田垄返回409。

PUT /settings:
```json
{"minGrowth":2,"maxGrowth":6,"inspectionDays":3}
```

上下限单位cm/周，下限非负且上限必须更大；巡检间隔1至30天整数。
日期示例提交时请使用有效业务日期。

## 聚合与空数据

成熟、转色、未成熟、不确定四类互斥，之和等于 fruitTotal。多标签症状不相加作为总对象数。
增长量加权均值排除待首次巡检田垄。跨作物查询返回空趋势数组，提示前端先选作物。
新建批次未采样的数值目前为0，由quality字段区分真实零与待采样；真实后端可调整契约为nullable并同步共享类型。


## 采集照片
GET /api/crops 的每个作物返回 images 数组：id、url、title、capturedAt（ISO 时间或 null）。未提供的拍摄时间保持 null，当前两张照片仅关联作物，不指定田垄、拍摄日期或品种。
照片原文件保存在 mock/media，由 GET /api/media/tomato-field.png 和 /api/media/strawberry-field.png 返回 image/png。前端只读取 API 返回的地址；真实服务可返回 HTTPS 对象存储 URL 或相对于 API 服务的地址。跨域 API 的根路径图片地址按该 API 的源解析。生产环境需由后端或网关提供媒体路由；私有图片建议返回短期签名地址。


## 健康检测与采收概况
GET /api/ridges/:id/detections 返回 ridgeId、items；每项包含图片 id/url/title/capturedAt、target（leaf/fruit）、result（healthy/diseased）、source（ai-generated）。空垄、未巡检返回空数组。当前复用四张 AI 生成测试图，不代表真实田垄检测；图片按完整对象框选。15/17 号垄为番茄有病图，23 号垄为草莓有病图，其他已巡检在种田垄返回对应健康图。未伪造拍摄时间或置信度。
GET /api/harvest-summary 返回按北京时间统计的今日、本周（周一开始）、累计采收重量，以及各在种田垄本批次采收重量/次数；统计来自全部采收记录，独立于分页。

## 参数规则扩展

- `GET /api/settings`：通用规则、`overrides`（以作物 ID 为键的完整独立规则）、`updatedAt`。
- `GET /api/settings/defaults`：默认规则。前端恢复默认仅修改草稿，点击保存才生效。
- `PUT /api/settings`：保存并返回完整参数。兼容原有三个字段的部分更新；独立作物规则须包含全部规则字段。任何一项无效时整次请求返回 422，不修改已有值。移除某作物 override 后恢复继承通用规则。

| 字段 | 含义 | 范围 |
| --- | --- | --- |
| minGrowth / maxGrowth | 单次增长幅度上下限，cm | 0 ≤ 下限 < 上限 ≤ 100 |
| minPlantSamples | 增长幅度评价最低有效植株数 | 1–10000 整数 |
| leafDiseasePercent / fruitDiseasePercent | 病叶/病果比例提醒阈值，% | 大于 0，最多 100 |
| minLeafSamples / minFruitSamples | 最低有效叶片/果实数 | 1–10000 整数 |
| reviewDays | 自检测时间起的病斑复核期限，天 | 1–30，不超过数据有效期 |
| maturePercent | 成熟果占比提醒阈值，% | 大于 0，最多 100 |
| harvestInspectionDays | 达到成熟阈值后的巡检间隔，天 | 1–30，不长于常规间隔 |
| inspectionDays | 常规巡检间隔，天 | 1–30 整数 |
| staleDays | 巡检数据有效期，天 | 1–30，不短于常规间隔 |

田垄新增 `plantSampleCount`、`leafSampleCount`、`diseasedLeafCount`、`diseasedFruitCount`。病叶比例 = 病叶数量 / 有效检测叶片数；病果比例 = 病果数量 / fruitCount；成熟比例 = mature / fruitCount。分母不足时不进行对应评价。单次增长幅度趋势按有效检测植株数量加权。过期数据不参与生长趋势和成熟统计，仍保留在田垄历史显示中。达到病害阈值显示比例超限；即使低于阈值，存在病斑仍保留复核提醒。采收提醒仅代表成熟果占比达到设定阈值，不会自动结束种植或提交采收。

当前范围为通用或指定作物品种（由 cropId 绑定）。尚无独立生育期字段，因此未添加无效的生育期选项。默认数值用于 Mock 联调，并非针对品种验证后的农艺标准。设置保存在模拟服务内存，刷新网页仍保留，重启模拟服务会重置。接入真实后端时需持久化设置与更新时间，并按相同口径提供检测样本数量。当前无人工复核完成记录，复核期限表示距本次检测的提醒期限。

## 作物档案汇总

`GET /api/crop-summaries` 返回 `CropSummary[]`，包含每种作物的在种田垄、登记苗数、在种批次数、按有效样本加权的相对上次检测的平均增长幅度、待关注田垄、达到采收提醒的田垄、有效果实与成熟果数量、历史累计采收重量和最近巡检时间。无有效增长量样本时平均值为 null；无有效果实时数量为 0，前端不展示虚构比例；结束批次不计入在种数量，其历史采收仍保留。保存种植、采收或参数后，通过统一刷新更新该接口数据。

## 生长趋势周/月切换

`GET /api/growth-trend?cropId=tomato&granularity=week`，`granularity` 支持 `week`（默认）和 `month`，其他值返回 400。返回 `{cropId, granularity, unit: "cm", points: [{label, periodStart, periodEnd, sampleCount, value}]}`，统一使用标准响应外层。

最近 6 个自然周（周一开始）或自然月，包含当前未结束周期，按北京时间划分日期。Mock 服务生成当前批次种植日期以来的逐日检测记录，再按周期和有效检测植株数加权平均单次增长幅度。每条历史记录独立检查最低样本数；没有数据的周期 `value: null`、`sampleCount: 0`，图表留空且不补零。当前周期截至今日；历史批次、已结束田垄、未来记录不纳入。`sampleCount` 为周期内有效检测植株的累计人次式计数，非去重苗数。未指定作物时返回空 points，避免混合不同作物增长量。前端通过独立 API 请求刷新图表，并使用请求序号防止快速切换时旧结果覆盖新结果。

## 田块选择与地图成熟度

`GET /api/fields` 返回可选田块。业务接口支持 `fieldId`，省略时默认 `field-3`；未知值返回 400。Mock 提供 1/2/3 号田独立的田垄、种植和采收记录，田垄 ID 跨田唯一。`profile` 增加 fieldId 并返回当前田名。工作台、作物汇总、周/月趋势、田垄与检测、采收汇总及新增记录均限定当前田块。参数设置为农场通用/作物规则，在各田共享。切田后重新请求数据并清除旧田详情，保持作物筛选及周/月选择。

田垄地图展示有效检测的成熟果占比，达到配置阈值时增加金色采收提醒标记，与异常底色并存。详情新增成熟/转色/未成熟/不确定数量及比例。无有效样本或过期数据显示成熟度待检测，空垄不显示成熟标记。

## 农场下拉选择

`GET /api/farms` 返回当前可选农场，目前仅 `[{id:"qinghe",name:"青禾农场"}]`。`profile` 增加 farmId；业务请求及田块列表携带 farmId，省略时使用当前唯一农场，未知农场返回 400。前端统一组件展示农场与田块两个下拉框，农场选项由接口加载；选择当前农场不重置田块或已有筛选。


### 生长趋势明细
`GET /api/growth-trend?cropId=tomato&granularity=week&detail=true`：保留最近 6 个日历周/月的范围，周视图按日聚合、月视图按周聚合，响应 `sampling` 标明 `day` / `week`；默认 `detail=false` 保持按周/月的 6 个汇总点，`sampling` 与 `granularity` 一致。非法 detail 返回 400。
明细仅从范围内首个有效观测所在日/周开始，到当前日期结束。缺测周期保留 null，不插值；未来记录、已结束批次、样本不足的记录不参与加权。前端注明聚合粒度、实际日期范围和有效点数。
分垄成熟列表展示当前筛选范围全部在种田垄，按成熟果占比降序排列，无有效成熟判定的田垄排末尾；百分比为成熟果数 / 有效果实数，显示时四舍五入。


### 相对增长量定义

系统不记录或展示植株绝对高度。`Ridge.growthCm` 是本次相对上次有效检测的高度增量（cm），`previousSampledAt` 保存对比检测时间；首次检测或无法对比时两者为 null。历史记录使用 `GrowthObservation.growthCm` 和 `previousDate`，同批次内按有效检测样本数加权聚合单次增量，不对平均绝对高度作差，也不把各时段增量累计成高度。零增长是有效数值，缺失基准、无效样本及非有限数值不参与统计。作物概况使用 `averageGrowth`，原 absolute-height 字段不再返回。生长评价上下限适用于单次检测间隔；调整巡检频率时应同时核对阈值。

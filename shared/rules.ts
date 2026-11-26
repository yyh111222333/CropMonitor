import {assessHarvest,type MaturityProfile} from './monitoring'
import type {Ridge, RuleSettings, Settings} from './contracts'

export function effectiveRules(settings: Settings, cropId: string): RuleSettings {
  return settings.overrides[cropId] ?? settings
}

export function evaluateRidge(r: Ridge, rules: RuleSettings, now = Date.now(), profile?:MaturityProfile) {
  const issues: string[] = []
  const age = (now - Date.parse(r.sampledAt)) / 86400000
  const fresh = Number.isFinite(age) && age >= 0 && age < rules.staleDays
  const usable = r.active && r.quality === '可用' && fresh
  const leafRate = r.leafSampleCount >= rules.minLeafSamples ? r.diseasedLeafCount / r.leafSampleCount * 100 : null
  const fruitRate = r.fruitCount >= rules.minFruitSamples ? r.diseasedFruitCount / r.fruitCount * 100 : null
  const leafy = profile?.kind==='leafy'
  const maturity = !leafy && usable && r.fruitCount >= rules.minFruitSamples ? r.mature / r.fruitCount * 100 : null
  const harvestReady = profile ? assessHarvest(r,rules,profile,now).ready : maturity !== null && maturity >= rules.maturePercent
  const comparable = r.growthCm !== null && Number.isFinite(r.growthCm) && r.previousSampledAt !== null && Number.isFinite(Date.parse(r.previousSampledAt)) && Date.parse(r.previousSampledAt) >= Date.parse(r.plantedAt) && Date.parse(r.previousSampledAt) < Date.parse(r.sampledAt)
  const interval = harvestReady ? rules.harvestInspectionDays : rules.inspectionDays
  if (r.active && r.quality !== '待首次巡检') {
    if (r.quality !== '可用') issues.push('数据待复核')
    if (!fresh) issues.push('巡检数据过期')
    if (age >= interval) issues.push('巡检已到期')
    if (usable) {
      if (leafRate !== null && r.diseasedLeafCount > 0 && leafRate >= rules.leafDiseasePercent) issues.push('病叶比例超限')
      if (!leafy && fruitRate !== null && r.diseasedFruitCount > 0 && fruitRate >= rules.fruitDiseasePercent) issues.push('病果比例超限')
      if (r.lesions > 0) issues.push(age >= rules.reviewDays ? '病斑复核已到期' : '病斑待复核')
      if (r.plantSampleCount < rules.minPlantSamples || leafRate === null || (!leafy && fruitRate === null)) issues.push('检测样本不足')
      if (r.plantSampleCount >= rules.minPlantSamples && comparable) {
        if (r.growthCm! < rules.minGrowth) issues.push('长势偏慢')
        if (r.growthCm! > rules.maxGrowth) issues.push('长势偏快')
      }
    }
  }
  const status = !r.active ? '空垄' : r.quality === '待首次巡检' ? '待巡检' : issues[0] ?? '生长正常'
  const nextInspection = r.active && r.quality !== '待首次巡检' && Number.isFinite(age) ? new Date(Date.parse(r.sampledAt) + interval * 86400000).toISOString() : null
  return {issues, status, usable, comparable, leafRate, fruitRate, maturity, harvestReady, nextInspection}
}

export function validateRules(r: RuleSettings): string | null {
  const keys: (keyof RuleSettings)[] = ['minGrowth','maxGrowth','inspectionDays','leafDiseasePercent','fruitDiseasePercent','reviewDays','maturePercent','harvestInspectionDays','staleDays','minPlantSamples','minLeafSamples','minFruitSamples']
  if (!keys.every(k => typeof r[k] === 'number' && Number.isFinite(r[k]))) return '请填写全部参数，且必须是有效数字'
  if (r.minGrowth < 0 || r.maxGrowth <= r.minGrowth || r.maxGrowth > 100) return '单次增长幅度上限须大于下限，范围为 0～100 cm'
  if (![r.leafDiseasePercent,r.fruitDiseasePercent,r.maturePercent].every(v => v > 0 && v <= 100)) return '比例须大于 0 且不超过 100%'
  if (![r.inspectionDays,r.reviewDays,r.harvestInspectionDays,r.staleDays].every(v => Number.isInteger(v) && v >= 1 && v <= 30)) return '天数须为 1～30 的整数'
  if (r.staleDays < r.inspectionDays) return '数据有效期不能短于常规巡检间隔'
  if (r.harvestInspectionDays > r.inspectionDays) return '采收期巡检间隔不能长于常规巡检间隔'
  if (r.reviewDays > r.staleDays) return '病斑复核期限不能长于数据有效期'
  if (![r.minPlantSamples,r.minLeafSamples,r.minFruitSamples].every(v => Number.isInteger(v) && v >= 1 && v <= 10000)) return '最低样本数须为 1～10000 的整数'
  return null
}

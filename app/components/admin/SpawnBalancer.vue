<template>
  <div class="balancer">
    <header>
      <h2>Spawn Balancer</h2>
      <p>Changes update the rules JSON below. Enemy probabilities are conditional on an enemy spawning.</p>
    </header>
    <p v-if="editor.status === 'invalid'" role="alert">{{ editor.message }}</p>
    <div v-else-if="editor.status === 'legacy'">
      <p>This configuration uses legacy enemy progression. Enable the curve to replace it in this unpublished copy.</p>
      <button type="button" @click="enableCurve">Use spawn curve</button>
    </div>
    <template v-else>
    <section class="controls">
      <label
        >Friendly Spawn Rate <strong>{{ fmtPercent(friendlyPercent) }} %</strong
        ><input
          v-model.number="friendlyPercent"
          type="range"
          min="0"
          max="100"
          step="any"
      /></label>
      <label
        >Difficulty buffer <strong>+{{ fmtPercent(difficultyPercent) }} %</strong
        ><input
          v-model.number="difficultyPercent"
          type="range"
          min="0"
          max="100"
          step="any"
      /></label>
      <label
        >Peak position <strong>{{ fmtPercent(peakPercent) }} %</strong
        ><input
          v-model.number="peakPercent"
          type="range"
          min="0.000001"
          max="99.999999"
          step="any"
      /></label>
      <label
        >Max. active tiers <strong>{{ maxActiveTiers }}</strong><input
          v-model.number="maxActiveTiers"
          type="range"
          min="2"
          max="12"
          step="1"
      /></label>
      <label
        >Max tier <strong>{{ maxTier }}</strong><input
          v-model.number="maxTier"
          type="range"
          min="1"
          max="12"
          step="1"
      /></label>
    </section>
    <section class="panel">
      <div class="section-title">
        <h2>Spawn probabilities</h2>
        <span>Turn {{ fmt(selectedTurn) }}</span>
      </div>
      <svg
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        role="img"
        aria-label="Spawn probability by turn"
        class="chart"
      >
        <g v-for="pct in [0, 0.25, 0.5, 0.75, 1]" :key="pct">
          <line
            :x1="left"
            :x2="chartWidth - right"
            :y1="y(pct)"
            :y2="y(pct)"
            class="gridline"
          />
          <text :x="left - 8" :y="y(pct) + 4" text-anchor="end" class="axis">
            {{ pct * 100 }}%
          </text>
        </g>
        <g v-for="tick in ticks" :key="tick">
          <text
            :x="x(tick)"
            :y="chartHeight - 8"
            text-anchor="middle"
            class="axis"
          >
            {{ fmt(tick) }}
          </text>
        </g>
        <polyline
          v-for="curve in curves"
          :key="curve.tier"
          :points="curve.points"
          fill="none"
          :stroke="curve.color"
          stroke-width="2.5"
          stroke-linejoin="round"
        />
        <line
          :x1="x(selectedTurn)"
          :x2="x(selectedTurn)"
          :y1="top"
          :y2="y(0)"
          stroke="white"
          stroke-width="2"
          stroke-dasharray="5 5"
        />
      </svg>
      <div class="legend">
        <span v-for="curve in curves" :key="curve.tier"
          ><i :style="{ background: curve.color }" />T{{ curve.tier }}</span
        >
      </div>
      <label class="turn-slider"
        >Turn <strong>{{ fmt(selectedTurn) }}</strong><input
          v-model.number="selectedTurn"
          type="range"
          min="0"
          :max="horizon"
          step="1"
      /></label>
      <label class="turn-slider">
        Exact turn
        <input v-model.number="selectedTurn" type="number" min="0" :max="horizon" step="1" @change="normalizeTurn">
      </label>
      <p class="hint">The chart uses a logarithmic turn axis to show both early and late tiers.</p>
      <div class="stack">
        <div
          v-for="row in distribution"
          :key="row.tier"
          :style="{
            width: `${row.probability * 100}%`,
            background: colors[(row.tier - 1) % colors.length],
          }"
          :title="`T${row.tier}: ${(row.probability * 100).toFixed(2)}%`"
        />
      </div>
      <div class="probabilities">
        <div v-for="row in distribution" :key="row.tier">
          <span :style="{ color: colors[(row.tier - 1) % colors.length] }"
            >● T{{ row.tier }}</span
          ><strong>{{ (row.probability * 100).toFixed(1) }} %</strong>
        </div>
      </div>
    </section>
    <section class="panel">
      <h2>Unlock turns</h2>
      <div class="unlock-grid">
        <div v-for="tier in maxTier" :key="tier">
          <span>T{{ tier }}</span
          ><strong>Turn {{ fmt(unlockTurn(tier, config)) }}</strong>
        </div>
      </div>
      <p class="hint">
        Tier 1 starts at turn 0. Tiers are removed when the tier
        {{ maxActiveTiers }} positions above them unlocks. The highest configured
        tier remains available in the endgame.
      </p>
      <p v-if="config.friendlySpawnRate === 0" class="hint">With no friendly spawns, higher tiers never unlock.</p>
      <p v-if="config.friendlySpawnRate === 1" class="hint">With only friendly spawns, no enemies will appear.</p>
      <p v-if="horizonLimited" class="hint">The chart is limited to the first {{ fmt(horizon) }} turns.</p>
    </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  defaultSpawnConfig,
  spawnDistribution,
  unlockTurn,
  type SpawnConfig,
} from '~~/game/spawn'
import { enableSpawnCurve, readSpawnEditor, updateSpawnEditor } from '~~/app/utils/spawnConfigEditor'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const editor = computed(() => readSpawnEditor(props.modelValue))
const config = computed(() => editor.value.status === 'curve' ? editor.value.config : defaultSpawnConfig)

function parameter(key: keyof SpawnConfig, scale = 1) {
  return computed({
    get: () => config.value[key] * scale,
    set: (value: number) => {
      if (editor.value.status !== 'curve') throw new Error('Cannot edit a spawn curve that is not configured')
      emit('update:modelValue', updateSpawnEditor(editor.value, { ...config.value, [key]: value / scale }))
    },
  })
}

function enableCurve() {
  if (editor.value.status !== 'legacy') throw new Error('Cannot replace a spawn curve that is not legacy')
  emit('update:modelValue', enableSpawnCurve(editor.value))
}

const friendlyPercent = parameter('friendlySpawnRate', 100)
const difficultyPercent = parameter('difficultyBuffer', 100)
const maxActiveTiers = parameter('maxActiveTiers')
const peakPercent = parameter('peakPosition', 100)
const maxTier = parameter('maxTier')
const turn = ref(48)
const maxChartTurn = Number.MAX_SAFE_INTEGER
const chartWidth = 900
const chartHeight = 300
const left = 45
const right = 15
const top = 15
const bottom = 30
const colors = [
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#c084fc',
  '#fb7185',
  '#22d3ee',
  '#a3e635',
  '#fb923c',
  '#f472b6',
  '#818cf8',
  '#2dd4bf',
  '#eab308',
]

const lastUnlock = computed(() => unlockTurn(maxTier.value + maxActiveTiers.value, config.value))
const horizonLimited = computed(() => config.value.friendlySpawnRate > 0 && lastUnlock.value > maxChartTurn)
const horizon = computed(() =>
  config.value.friendlySpawnRate === 0 ? 100 : Math.min(lastUnlock.value, maxChartTurn),
)
const selectedTurn = computed({
  get: () => Math.min(turn.value, horizon.value),
  set: (value: number) => {
    if (Number.isFinite(value)) turn.value = Math.max(0, Math.min(Math.floor(value), horizon.value))
  },
})
function normalizeTurn(event: Event) {
  if (event.target instanceof HTMLInputElement) event.target.value = String(selectedTurn.value)
}
const distribution = computed(() => spawnDistribution(selectedTurn.value, config.value))
const x = (t: number) =>
  left + (Math.log1p(t) / Math.log1p(horizon.value)) * (chartWidth - left - right)
const turnAt = (fraction: number) => Math.expm1(fraction * Math.log1p(horizon.value))
const y = (p: number) => top + (1 - p) * (chartHeight - top - bottom)
const curves = computed(() =>
  Array.from({ length: maxTier.value }, (_, i) => {
    const tier = i + 1
    const points: string[] = []
    for (let k = 0; k <= 450; k++) {
      const t = turnAt(k / 450)
      const p =
        spawnDistribution(t, config.value).find((row) => row.tier === tier)
          ?.probability ?? 0
      points.push(`${x(t).toFixed(2)},${y(p).toFixed(2)}`)
    }
    return { tier, points: points.join(' '), color: colors[i % colors.length] }
  }),
)
const ticks = computed(() =>
  Array.from({ length: 6 }, (_, i) => Math.round(turnAt(i / 5))),
)
const fmt = (v: number) => Number.isFinite(v) ? new Intl.NumberFormat('en-US').format(v) : 'Never'
const fmtPercent = (v: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(v)
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.balancer {
  font-family: Inter, system-ui, sans-serif;
  background: #0c1220;
  color: #e8edf7;
  padding: 20px;
  max-width: 1200px;
  margin: auto;
}

.eyebrow {
  font-size: 11px;
  letter-spacing: 0.2em;
  color: #93a6c9;
}

h1 {
  font-size: 38px;
  margin: 8px 0;
}

h2 {
  font-size: 18px;
  margin: 0 0 16px;
}

p {
  color: #9eabc2;
}

header {
  margin-bottom: 28px;
}

.controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.controls label,
.panel {
  background: #151e30;
  border: 1px solid #2b3850;
  border-radius: 14px;
  padding: 18px;
}

.controls label,
.turn-slider {
  font-size: 13px;
  color: #b7c3d8;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.controls strong,
.turn-slider strong {
  color: white;
  font-size: 18px;
}

input[type='range'] {
  width: 100%;
  accent-color: #6da4ff;
  cursor: pointer;
}

.panel {
  margin-bottom: 18px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title span {
  font-weight: 700;
}

.chart {
  width: 100%;
  height: auto;
  display: block;
}

.gridline {
  stroke: #34415a;
  stroke-width: 1;
}

.axis {
  fill: #91a1bd;
  font-size: 12px;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 8px 0 22px;
  font-size: 12px;
}

.legend span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.turn-slider {
  margin-bottom: 20px;
}

.stack {
  height: 20px;
  display: flex;
  overflow: hidden;
  border-radius: 7px;
  background: #26334a;
}

.stack > div {
  min-width: 0;
}

.probabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 16px;
}

.probabilities > div {
  display: flex;
  gap: 10px;
  align-items: center;
}

.unlock-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}

.unlock-grid > div {
  background: #202c41;
  border-radius: 9px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.unlock-grid span {
  color: #a9b8d0;
  font-size: 13px;
}

.hint {
  font-size: 12px;
  line-height: 1.6;
  margin-top: 20px;
}
</style>

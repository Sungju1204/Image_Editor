<script setup>
const props = defineProps({
  lines: {
    type: Array,
    required: true
  },
  hoveredLineId: {
    type: Number,
    default: null
  },
  selectedLineId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['duplicate', 'delete', 'select'])

// ImageDraw와 동일한 팔레트 사용
const TYPE_PALETTE = {
  horizontal: ['#e11d48', '#f97316'], // H1, H2
  vertical: ['#0ea5e9', '#22c55e']    // V1, V2
}

const getDisplayName = (line) => {
  const ofType = props.lines.filter(l => l.type === line.type)
  const index = ofType.findIndex(l => l.id === line.id)
  const label = line.type === 'horizontal' ? 'H' : 'V'
  return `${label}${index + 1}`
}

const getBadgeColor = (line) => {
  const ofType = props.lines.filter(l => l.type === line.type).map(l => l.id)
  const idx = Math.max(0, ofType.indexOf(line.id))
  const palette = TYPE_PALETTE[line.type] || []
  return palette[idx] || (line.type === 'horizontal' ? '#e11d48' : '#0ea5e9')
}
</script>

<template>
  <div class="lines-panel" v-if="lines.length > 0">
    <h3 class="lines-panel-title">선분 목록</h3>
    <div class="lines-list">
      <div 
        v-for="line in lines" 
        :key="line.id" 
        class="line-item"
        :class="{
          'line-item-hovered': hoveredLineId === line.id,
          'line-item-selected': selectedLineId === line.id
        }"
        @click="emit('select', line.id)"
      >
        <span class="line-type-badge" :style="{ backgroundColor: getBadgeColor(line) }">
          {{ getDisplayName(line) }}
        </span>
        <span class="line-meta">
          ({{ line.start.x }}, {{ line.start.y }}) → ({{ line.end.x }}, {{ line.end.y }})
        </span>
        <button class="line-action-btn" @click.stop="emit('duplicate', line.id)" title="평행 선분 복사">
          복사
        </button>
        <button class="line-action-btn delete" @click.stop="emit('delete', line.id)" title="선분 삭제">
          삭제
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lines-panel {
  width: 100%;
  max-width: 800px;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #1e1e1e;
  border-radius: 8px;
  border: 1px solid #333;
}

.lines-panel-title {
  font-size: 1rem;
  color: #ffffff;
  margin-bottom: 0.75rem;
  font-weight: 600;
}

.lines-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.line-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background-color: #2a2a2a;
  border-radius: 6px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.line-item-hovered {
  background-color: #333;
  border: 1px solid #646cff;
}

.line-item-selected {
  background-color: #2f2f2f;
  border: 2px solid #f59e0b; /* 선택 강조 */
}

.line-item:hover {
  background-color: #343434;
  transform: translateY(-1px);
}

.line-item:active {
  transform: translateY(0);
  filter: brightness(1.05);
}

.line-type-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 600;
  min-width: 50px;
  text-align: center;
}

.badge-h {
  background-color: #ff0000;
  color: #ffffff;
}

.badge-v {
  background-color: #0000ff;
  color: #ffffff;
}

.line-meta {
  color: #bbb;
  font-size: 0.8rem;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.line-action-btn {
  background-color: #646cff;
  color: #ffffff;
  border: none;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.line-action-btn:hover {
  background-color: #535bf2;
  transform: translateY(-1px);
}

.line-action-btn.delete {
  background-color: #ef4444;
}

.line-action-btn.delete:hover {
  background-color: #dc2626;
}
</style>


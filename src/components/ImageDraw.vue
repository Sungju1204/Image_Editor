<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import LineList from './LineList.vue'
import ImageNavigation from './ImageNavigation.vue'

const CONSTANTS = {
  LINE_DETECTION_THRESHOLD: 5,
  POINT_ON_LINE_THRESHOLD: 10,
  REQUIRED_LINES: 4
}

const COLORS = {
  // 기본 색
  HORIZONTAL_LINE: '#e11d48', // rose-600
  VERTICAL_LINE: '#0ea5e9',   // sky-500
  HOVERED_LINE: '#ffff00',
  DRAGGING_LINE: '#00ff00',
  INTERSECTION_POINT: '#00ff00',
  TEMP_LINE: '#888888',
  POINT: '#ff0000'
}
// 타입 내 인덱스별 색상 팔레트
const TYPE_PALETTE = {
  // 더 구분 쉬운 고대비 팔레트
  horizontal: ['#e11d48', '#f97316'], // H1: rose-600, H2: orange-500
  vertical: ['#0ea5e9', '#22c55e']    // V1: sky-500,  V2: green-500
}

const props = defineProps({
  imageUrl: {
    type: String,
    required: true
  },
  lines: {
    type: Array,
    required: true
  },
  selectedLineId: {
    type: Number,
    default: null
  },
  currentImageInfo: {
    type: Object,
    required: true
  },
  progressPercentage: {
    type: Number,
    default: 0
  },
  imageListLength: {
    type: Number,
    default: 0
  },
  instruction: {
    type: String,
    default: ''
  }
})

const emit = defineEmits([
  'line-added',
  'line-updated',
  'line-deleted',
  'line-duplicated',
  'correction',
  'reset',
  'next',
  'previous',
  'select-line'
])

const canvasRef = ref(null)
const wrapperRef = ref(null)
const imageRef = ref(null)
const lineIdCounter = ref(0)
const draggingLine = ref(null)
const isGrabMode = ref(false)
const grabbedLineId = ref(null)
const dragOffset = ref({ x: 0, y: 0 })
const isDrawingLine = ref(false)
const tempLineStart = ref(null)
const tempLineType = ref(null)
const hoveredLineId = ref(null)
const currentMousePos = ref({ x: 0, y: 0 })
const lastMousePos = ref(null)

// lines가 변경될 때마다 lineIdCounter 업데이트
watch(() => props.lines, (newLines) => {
  if (newLines.length > 0) {
    const maxId = Math.max(...newLines.map(l => l.id || 0))
    lineIdCounter.value = Math.max(lineIdCounter.value, maxId + 1)
  }
}, { immediate: true })

// 이미지 로드 시 캔버스 그리기 (최적화: 한 번만 실행)
watch(() => props.imageUrl, (newUrl) => {
  if (!newUrl) return
  
  // 이미지가 이미 로드되어 있으면 즉시 그리기
  nextTick(() => {
    if (imageRef.value) {
      if (imageRef.value.complete && imageRef.value.naturalWidth > 0) {
        // 이미 로드된 경우 즉시 그리기
        requestAnimationFrame(() => {
          redrawCanvas()
        })
      } else {
        // 로딩 중인 경우 onload 이벤트 사용
        imageRef.value.onload = () => {
          requestAnimationFrame(() => {
            redrawCanvas()
          })
        }
        // 이미지 로드 실패 시에도 처리
        imageRef.value.onerror = () => {
          console.error('이미지 로드 실패:', newUrl)
        }
      }
    }
  })
}, { immediate: true })

// 목록에서 선택된 선 변경 시, 하이라이트 및 커서/드래그 모드 준비
watch(() => props.selectedLineId, (id) => {
  hoveredLineId.value = id ?? null
  // 선택되면 그랩 모드로 들어가 클릭-홀드 없이 이동 가능
  isGrabMode.value = id !== null
  grabbedLineId.value = id ?? null
  lastMousePos.value = null
  if (wrapperRef.value) {
    wrapperRef.value.style.cursor = id !== null ? 'move' : 'crosshair'
  }
  redrawCanvas()
})

/**
 * 점이 선 위에 있는지 확인
 */
const isPointOnLine = (point, line, threshold = CONSTANTS.POINT_ON_LINE_THRESHOLD) => {
  const { start, end } = line
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.sqrt(dx * dx + dy * dy)
  
  if (length === 0) return false
  
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (length * length)))
  const proj = {
    x: start.x + t * dx,
    y: start.y + t * dy
  }
  
  const dist = Math.sqrt(Math.pow(point.x - proj.x, 2) + Math.pow(point.y - proj.y, 2))
  return dist <= threshold
}

/**
 * 선분 그리기 시작
 */
const handleCanvasMouseDown = (event) => {
  const rect = (wrapperRef.value || imageRef.value).getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const point = { x, y }
  
  // 목록에서 선택된 선이 있는 경우 처리
  if (props.selectedLineId !== null || isGrabMode.value) {
    // 먼저 선 위를 클릭했는지 확인
    let clickedOnLine = false
    for (let i = props.lines.length - 1; i >= 0; i--) {
      const line = props.lines[i]
      if (isPointOnLine(point, line)) {
        clickedOnLine = true
        const selected = props.lines.find(l => l.id === (props.selectedLineId || grabbedLineId.value))
        if (selected && selected.id === line.id) {
          // 선택된 선 위를 클릭하면 드래그 시작
          isDrawingLine.value = false
          tempLineStart.value = null
          tempLineType.value = null
          draggingLine.value = selected.id
          dragOffset.value = {
            x: x - selected.start.x,
            y: y - selected.start.y
          }
          return
        } else {
          // 다른 선을 클릭하면 그 선으로 그랩 모드 전환
          isDrawingLine.value = false
          tempLineStart.value = null
          tempLineType.value = null
          isGrabMode.value = true
          grabbedLineId.value = line.id
          lastMousePos.value = { x, y }
          hoveredLineId.value = line.id
          emit('select-line', line.id)
          if (wrapperRef.value) wrapperRef.value.style.cursor = 'move'
          redrawCanvas()
          return
        }
      }
    }
    
    // 선 위가 아닌 빈 공간을 클릭하면 그랩 모드 해제
    if (!clickedOnLine) {
      isGrabMode.value = false
      grabbedLineId.value = null
      lastMousePos.value = null
      hoveredLineId.value = null
      emit('select-line', null)
      if (wrapperRef.value) wrapperRef.value.style.cursor = 'crosshair'
      redrawCanvas()
      // 그랩 모드 해제 후에는 선 그리기로 진행
    }
  }
  
  // 기존 선분 클릭 확인 (그랩 모드 활성화) - 목록 선택이 없을 때만
  if (props.selectedLineId === null && !isGrabMode.value) {
    for (let i = props.lines.length - 1; i >= 0; i--) {
      const line = props.lines[i]
      if (isPointOnLine(point, line)) {
        // 같은 선을 다시 클릭하면 그랩 모드 해제 (토글)
        if (isGrabMode.value && grabbedLineId.value === line.id) {
          isGrabMode.value = false
          grabbedLineId.value = null
          lastMousePos.value = null
          emit('select-line', null)
          if (wrapperRef.value) wrapperRef.value.style.cursor = 'crosshair'
        } else {
          // 그랩 모드 활성화
          isDrawingLine.value = false
          tempLineStart.value = null
          tempLineType.value = null
          isGrabMode.value = true
          grabbedLineId.value = line.id
          lastMousePos.value = { x, y }
          hoveredLineId.value = line.id
          emit('select-line', line.id)
          if (wrapperRef.value) wrapperRef.value.style.cursor = 'move'
        }
        redrawCanvas()
        return
      }
    }
  }
  
  // 선분 그리기 시작
  if (!isDrawingLine.value && props.lines.length < CONSTANTS.REQUIRED_LINES) {
    isDrawingLine.value = true
    tempLineStart.value = { x, y }
    tempLineType.value = null
    redrawCanvas()
  } else if (isDrawingLine.value && tempLineStart.value) {
    // 두 번째 점 클릭 - 선분 완성
    let end = { x, y }
    
    if (!tempLineType.value) {
      const dx = Math.abs(end.x - tempLineStart.value.x)
      const dy = Math.abs(end.y - tempLineStart.value.y)
      tempLineType.value = dx > dy ? 'horizontal' : 'vertical'
    }
    
    if (tempLineType.value === 'horizontal') {
      end.y = tempLineStart.value.y
    } else {
      end.x = tempLineStart.value.x
    }
    
    // 타입별 최대 2개 제한
    const sameTypeCount = props.lines.filter(l => l.type === tempLineType.value).length
    if (sameTypeCount >= 2) {
      alert(`${tempLineType.value === 'horizontal' ? '수평선' : '수직선'}은 최대 2개까지 생성할 수 있습니다.`)
      isDrawingLine.value = false
      tempLineStart.value = null
      tempLineType.value = null
      redrawCanvas()
      return
    }
    
    const newLine = {
      id: lineIdCounter.value++,
      start: { ...tempLineStart.value },
      end: end,
      type: tempLineType.value
    }
    
    emit('line-added', newLine)
    isDrawingLine.value = false
    tempLineStart.value = null
    tempLineType.value = null
    redrawCanvas()
  }
}

/**
 * 선분 그리기 완료
 */
const handleCanvasMouseUp = () => {
  if (draggingLine.value !== null) {
    draggingLine.value = null
    dragOffset.value = { x: 0, y: 0 }
    redrawCanvas()
  }
}

/**
 * 선분 드래그 및 마우스 이동
 */
const handleCanvasMouseMove = (event) => {
  const rect = (wrapperRef.value || imageRef.value).getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  currentMousePos.value = { x, y }
  
  // 그랩 모드: 클릭-홀드 없이 이동
  if (isGrabMode.value && grabbedLineId.value !== null) {
    const line = props.lines.find(l => l.id === grabbedLineId.value)
    if (line) {
      if (!lastMousePos.value) {
        lastMousePos.value = { x, y }
      } else {
        const dx = x - lastMousePos.value.x
        const dy = y - lastMousePos.value.y
        if (dx !== 0 || dy !== 0) {
          const updatedLine = { ...line }
          if (line.type === 'horizontal') {
            updatedLine.start.y += dy
            updatedLine.end.y += dy
          } else {
            updatedLine.start.x += dx
            updatedLine.end.x += dx
          }
          emit('line-updated', updatedLine)
          lastMousePos.value = { x, y }
          redrawCanvas()
        }
      }
    }
  }
  
  // 드래그 중인 선분 이동
  if (draggingLine.value !== null) {
    const line = props.lines.find(l => l.id === draggingLine.value)
    if (line) {
      const dx = x - (line.start.x + dragOffset.value.x)
      const dy = y - (line.start.y + dragOffset.value.y)
      
      const updatedLine = { ...line }
      if (line.type === 'horizontal') {
        updatedLine.start.y += dy
        updatedLine.end.y += dy
      } else {
        updatedLine.start.x += dx
        updatedLine.end.x += dx
      }
      
      emit('line-updated', updatedLine)
      redrawCanvas()
    }
    return
  }
  
  // 호버 효과
  const point = { x, y }
  let foundHover = false
  for (let i = props.lines.length - 1; i >= 0; i--) {
    const line = props.lines[i]
    if (isPointOnLine(point, line)) {
      hoveredLineId.value = line.id
      foundHover = true
      if (canvasRef.value) {
        canvasRef.value.style.cursor = 'move'
      }
      break
    }
  }
  
  if (!foundHover) {
    hoveredLineId.value = props.selectedLineId ?? null
    if (canvasRef.value) {
      canvasRef.value.style.cursor = props.selectedLineId !== null ? 'move' : (isDrawingLine.value ? 'crosshair' : 'default')
    }
  }
  
  // 임시 선분 그리기
  if (isDrawingLine.value && tempLineStart.value) {
    if (!tempLineType.value) {
      const dx = Math.abs(x - tempLineStart.value.x)
      const dy = Math.abs(y - tempLineStart.value.y)
      if (dx > CONSTANTS.LINE_DETECTION_THRESHOLD || dy > CONSTANTS.LINE_DETECTION_THRESHOLD) {
        tempLineType.value = dx > dy ? 'horizontal' : 'vertical'
      }
    }
    redrawCanvas()
  }
}

/**
 * 마우스가 영역을 벗어날 때
 */
const handleCanvasMouseLeave = () => {
  draggingLine.value = null
  // 그랩 모드는 유지
  hoveredLineId.value = null
  if (canvasRef.value) {
    canvasRef.value.style.cursor = isGrabMode.value ? 'move' : (isDrawingLine.value ? 'crosshair' : 'default')
  }
  if (!isDrawingLine.value) {
    redrawCanvas()
  }
}

/**
 * 선분 복사
 */
const handleDuplicateLine = (lineId) => {
  const line = props.lines.find(l => l.id === lineId)
  if (!line) return
  // 타입별 최대 2개 제한
  const sameTypeCount = props.lines.filter(l => l.type === line.type).length
  if (sameTypeCount >= 2) {
    alert(`${line.type === 'horizontal' ? '수평선' : '수직선'}은 최대 2개까지 생성할 수 있습니다.`)
    return
  }
  
  // 고정 오프셋으로 복사 (기존: 길이만큼 이동 → 화면 밖으로 나가는 문제)
  const offset = line.type === 'horizontal' ? { x: 0, y: 10 } : { x: 10, y: 0 }
  
  const newLine = {
    id: lineIdCounter.value++,
    start: {
      x: line.start.x + offset.x,
      y: line.start.y + offset.y
    },
    end: {
      x: line.end.x + offset.x,
      y: line.end.y + offset.y
    },
    type: line.type
  }
  
  emit('line-duplicated', newLine)
  redrawCanvas()
}

/**
 * 선분 삭제
 */
const handleDeleteLine = (lineId) => {
  emit('line-deleted', lineId)
  redrawCanvas()
}

/**
 * 선분 목록에서 선택
 */
const handleSelectLine = (id) => {
  // id 유효성 검증
  if (id === null || id === undefined || id === false) {
    console.warn('Invalid line id:', id)
    return
  }
  
  // 같은 항목 재클릭 시 그랩 모드 토글 해제
  if (isGrabMode.value && grabbedLineId.value === id) {
    isGrabMode.value = false
    grabbedLineId.value = null
    lastMousePos.value = null
    hoveredLineId.value = null
    emit('select-line', null) // 부모 선택 해제
    if (wrapperRef.value) wrapperRef.value.style.cursor = 'crosshair'
    redrawCanvas()
  } else {
    // 목록에서 선택 시 즉시 그랩 모드로 전환
    isDrawingLine.value = false
    tempLineStart.value = null
    tempLineType.value = null
    hoveredLineId.value = id
    emit('select-line', id)
    isGrabMode.value = true
    grabbedLineId.value = id
    lastMousePos.value = null
    if (wrapperRef.value) wrapperRef.value.style.cursor = 'move'
    redrawCanvas()
  }
}

/**
 * 캔버스 다시 그리기
 */
const redrawCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas || !imageRef.value) return
  
  const ctx = canvas.getContext('2d')
  const img = imageRef.value
  
  // 캔버스를 wrapper 크기로 확장하여 이미지 주변에 여유 공간 제공
  const wrapper = wrapperRef.value
  const targetWidth = wrapper ? wrapper.clientWidth : img.offsetWidth
  const targetHeight = wrapper ? wrapper.clientHeight : img.offsetHeight
  canvas.width = targetWidth
  canvas.height = targetHeight
  
  // 이미지 위치(현재는 0,0 기준으로 렌더)
  const imgX = img.offsetLeft || 0
  const imgY = img.offsetTop || 0
  ctx.drawImage(img, imgX, imgY, img.offsetWidth, img.offsetHeight)
  
  // 선분 그리기
  // 타입 내 인덱스 계산 (H1/H2, V1/V2 구분)
  const typeOrder = { horizontal: [], vertical: [] }
  props.lines.forEach(l => { typeOrder[l.type].push(l.id) })
  props.lines.forEach((line) => {
    const isHovered = hoveredLineId.value === line.id || props.selectedLineId === line.id
    const isDragging = draggingLine.value === line.id
    
    // 타입 내 인덱스 기반 색상 선택
    const idxInType = Math.max(0, typeOrder[line.type].indexOf(line.id))
    const palette = TYPE_PALETTE[line.type] || []
    let strokeColor = palette[idxInType] || (line.type === 'horizontal' ? COLORS.HORIZONTAL_LINE : COLORS.VERTICAL_LINE)
    if (isDragging) strokeColor = COLORS.DRAGGING_LINE
    else if (isHovered) strokeColor = COLORS.HOVERED_LINE
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = isHovered || isDragging ? 4 : 3
    
    ctx.beginPath()
    ctx.moveTo(line.start.x, line.start.y)
    ctx.lineTo(line.end.x, line.end.y)
    ctx.stroke()
    
    const midX = (line.start.x + line.end.x) / 2
    const midY = (line.start.y + line.end.y) / 2
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px Arial'
    ctx.fillText(line.type === 'horizontal' ? 'H' : 'V', midX + 8, midY - 8)
    
    ctx.fillStyle = COLORS.POINT
    ctx.beginPath()
    ctx.arc(line.start.x, line.start.y, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(line.end.x, line.end.y, 6, 0, Math.PI * 2)
    ctx.fill()
  })
  
  // 임시 선분 그리기
  if (isDrawingLine.value && tempLineStart.value) {
    ctx.fillStyle = COLORS.POINT
    ctx.beginPath()
    ctx.arc(tempLineStart.value.x, tempLineStart.value.y, 8, 0, Math.PI * 2)
    ctx.fill()
    
    let mouseX = currentMousePos.value.x || tempLineStart.value.x
    let mouseY = currentMousePos.value.y || tempLineStart.value.y
    
    if (tempLineType.value === 'horizontal') {
      mouseY = tempLineStart.value.y
    } else if (tempLineType.value === 'vertical') {
      mouseX = tempLineStart.value.x
    }
    
    ctx.strokeStyle = COLORS.TEMP_LINE
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(tempLineStart.value.x, tempLineStart.value.y)
    ctx.lineTo(mouseX, mouseY)
    ctx.stroke()
    ctx.setLineDash([])
  }
  
  // 교점 표시 (4개 선분이 모두 있을 때)
  if (props.lines.length === 4) {
    const intersections = calculateIntersections()
    if (intersections.length === 4) {
      intersections.forEach((point, index) => {
        ctx.fillStyle = COLORS.INTERSECTION_POINT
        ctx.beginPath()
        ctx.arc(point.x, point.y, 8, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 16px Arial'
        ctx.fillText((index + 1).toString(), point.x + 12, point.y - 8)
      })
    }
  }
}

/**
 * 두 선분의 교점 계산
 */
const getLineIntersection = (line1, line2) => {
  const { start: p1, end: p2 } = line1
  const { start: p3, end: p4 } = line2
  
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x)
  if (Math.abs(denom) < 0.001) return null
  
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom
  
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y)
  }
}

/**
 * 교점 계산
 */
const calculateIntersections = () => {
  if (props.lines.length !== 4) return []
  
  const horizontalLines = props.lines.filter(l => l.type === 'horizontal')
  const verticalLines = props.lines.filter(l => l.type === 'vertical')
  
  if (horizontalLines.length !== 2 || verticalLines.length !== 2) return []
  
  const intersections = []
  
  for (const hLine of horizontalLines) {
    for (const vLine of verticalLines) {
      const intersection = getLineIntersection(hLine, vLine)
      if (intersection) {
        intersections.push(intersection)
      }
    }
  }
  
  intersections.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 10) {
      return a.y - b.y
    }
    return a.x - b.x
  })
  
  return intersections
}

// lines 변경 시 캔버스 다시 그리기
watch(() => props.lines, () => {
  nextTick(() => {
    redrawCanvas()
  })
}, { deep: true })

// imageRef를 부모 컴포넌트에서 사용할 수 있도록 expose
defineExpose({
  imageRef
})
</script>

<template>
  <div class="app-container">
    <div class="header">
      <span class="header-subtitle">이미지 보정 도구</span>
      <h1 class="header-title">이미지 보정 도구</h1>
      <p class="step-indicator">2단계: 수평선 2개와 수직선 2개를 그려주세요</p>
      <div class="progress-info" v-if="imageListLength > 1">
        <p class="progress-text">
          이미지 {{ currentImageInfo.index }} / {{ currentImageInfo.total }}
          <span class="progress-name">({{ currentImageInfo.name }})</span>
        </p>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
        </div>
        <p class="progress-percentage">{{ progressPercentage }}% 완료</p>
      </div>
      <p class="instruction-text">{{ instruction }}</p>
    </div>

    <div class="draw-area">
      <div 
        class="image-wrapper" 
        ref="wrapperRef"
        @mousedown="handleCanvasMouseDown"
        @mouseup="handleCanvasMouseUp"
        @mousemove="handleCanvasMouseMove"
        @mouseleave="handleCanvasMouseLeave"
      >
        <img ref="imageRef" :src="imageUrl" alt="업로드된 이미지" class="drawable-image" />
        <canvas ref="canvasRef" class="draw-canvas"></canvas>
      </div>
      
      <LineList 
        :lines="lines"
        :hovered-line-id="hoveredLineId"
        :selected-line-id="selectedLineId"
        @duplicate="handleDuplicateLine"
        @delete="handleDeleteLine"
        @select="handleSelectLine"
      />
      
      <div class="draw-buttons">
        <button 
          class="complete-btn" 
          @click="emit('correction')" 
          :disabled="lines.length !== 4"
        >
          보정 완료
        </button>
        <button class="reset-btn" @click="emit('reset')">처음부터 다시</button>
      </div>
      
      <ImageNavigation
        :current-index="currentImageInfo.index"
        :total="currentImageInfo.total"
        :can-go-previous="currentImageInfo.index > 1"
        :can-go-next="currentImageInfo.index < imageListLength"
        @previous="emit('previous')"
        @next="emit('next')"
      />
    </div>

    <div class="decoration">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="star-icon">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background-color: #1a1a1a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 2rem;
  position: relative;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
  margin-top: 2rem;
}

.header-subtitle {
  font-size: 0.875rem;
  color: #888;
  letter-spacing: 2px;
  text-transform: uppercase;
  text-decoration: underline;
  text-underline-offset: 8px;
}

.header-title {
  font-size: 3rem;
  font-weight: 700;
  color: #ffffff;
  margin: 1rem 0;
  letter-spacing: -1px;
}

.step-indicator {
  font-size: 1.25rem;
  color: #888;
  margin-top: 0.5rem;
}

.instruction-text {
  font-size: 1.1rem;
  color: #646cff;
  margin-top: 1rem;
  font-weight: 500;
}

.progress-info {
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  width: 100%;
  max-width: 600px;
}

.progress-text {
  font-size: 1rem;
  color: #888;
  margin-bottom: 0.75rem;
}

.progress-name {
  font-size: 0.875rem;
  color: #646cff;
  margin-left: 0.5rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #2a2a2a;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #646cff, #535bf2);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-percentage {
  font-size: 0.875rem;
  color: #646cff;
  font-weight: 600;
}

.draw-area {
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.image-wrapper {
  position: relative;
  width: 100%;
  max-width: 800px;
  margin-bottom: 2rem;
  cursor: crosshair;
  padding: 20px; /* 이미지 주변 클릭 가능 영역 확보 */
  background-color: #161616;
  border-radius: 8px;
}

.drawable-image {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.draw-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.draw-buttons {
  display: flex;
  gap: 1rem;
  width: 100%;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.complete-btn {
  background-color: #22c55e;
  color: #ffffff;
  border: none;
  padding: 0.875rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.complete-btn:hover:not(:disabled) {
  background-color: #16a34a;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.complete-btn:disabled {
  background-color: #444;
  cursor: not-allowed;
  opacity: 0.5;
}

.reset-btn {
  background-color: transparent;
  color: #888;
  border: 2px solid #444;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.reset-btn:hover {
  border-color: #888;
  color: #fff;
  background-color: #2a2a2a;
}

.decoration {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  color: #888;
  opacity: 0.3;
}

.star-icon {
  animation: twinkle 3s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.6;
  }
}

@media (max-width: 768px) {
  .header-title {
    font-size: 2rem;
  }
  
  .draw-buttons {
    flex-direction: column;
    width: 100%;
  }

  .complete-btn, .reset-btn {
    width: 100%;
  }
  
  .progress-info {
    max-width: 100%;
  }
}
</style>


<script setup>
import { ref, computed, nextTick } from 'vue'
import ImageUpload from './components/ImageUpload.vue'
import ImageDraw from './components/ImageDraw.vue'
import ImageResult from './components/ImageResult.vue'

// ==================== 상수 정의 ====================
const CONSTANTS = {
  LINE_DETECTION_THRESHOLD: 5, // 선분 방향 감지 임계값 (px)
  POINT_ON_LINE_THRESHOLD: 10, // 선 위 점 감지 임계값 (px)
  MIN_DATA_URL_LENGTH: 1000, // 최소 데이터 URL 길이
  REQUIRED_LINES: 4, // 필요한 선분 개수
  REQUIRED_HORIZONTAL: 2, // 필요한 수평선 개수
  REQUIRED_VERTICAL: 2 // 필요한 수직선 개수
}

const COLORS = {
  HORIZONTAL_LINE: '#ff0000',
  VERTICAL_LINE: '#0000ff',
  HOVERED_LINE: '#ffff00',
  DRAGGING_LINE: '#00ff00',
  INTERSECTION_POINT: '#00ff00',
  TEMP_LINE: '#888888',
  POINT: '#ff0000',
  BACKGROUND: '#ffffff'
}

// ==================== 상태 관리 ====================
// 파일 업로드 관련
const selectedFile = ref(null)
const isDragging = ref(false)
const fileInput = ref(null)
const currentStep = ref('upload')
const imageUrl = ref(null)
const imageRef = ref(null) // 이미지 보정에 필요
const imageDrawRef = ref(null) // ImageDraw 컴포넌트 참조
const points = ref([]) // 호환성을 위해 유지
const currentLine = ref(null)

// 선분 기반 시스템
const lines = ref([]) // {id, start: {x, y}, end: {x, y}, type: 'horizontal' | 'vertical'}
const lineIdCounter = ref(0)
const selectedLineId = ref(null)

// 여러 이미지 처리 관련 상태
const imageList = ref([]) // 업로드된 모든 이미지 파일
const currentImageIndex = ref(-1) // 현재 처리 중인 이미지 인덱스
const processedImages = ref([]) // 처리 완료된 이미지들 (결과 URL 저장)

// 일괄 처리 모드 관련 상태
const isBatchMode = ref(false) // 일괄 처리 모드 활성화 여부
const sharedLines = ref([]) // 공유된 선분 (첫 번째 이미지의 선분) - 화면 좌표 기준
const baseImageDisplaySize = ref({ width: 0, height: 0 }) // 기준 이미지 화면 표시 크기 (첫 번째 이미지)
const baseImageNaturalSize = ref({ width: 0, height: 0 }) // 기준 이미지 자연 크기 (첫 번째 이미지)
const isProcessingAll = ref(false) // 모든 이미지 처리 중 여부
const processingProgress = ref({ current: 0, total: 0 }) // 처리 진행 상황

// ==================== 파일 업로드 관련 함수 ====================
/**
 * 이미지 파일 리스트 초기화 및 처리 시작
 */
const initializeImageList = (files) => {
  const imageFiles = files.filter(file => file.type.startsWith('image/'))
  
  if (imageFiles.length === 0) {
    alert('이미지 파일을 선택해주세요.')
    return false
  }
  
  // 이미지 리스트 초기화 및 설정 (URL 생성은 나중에)
  imageList.value = imageFiles.map(file => ({
    file: file,
    name: file.name,
    url: null,
    processedUrl: null
  }))
  
  // 여러 이미지가 있으면 자동으로 일괄 처리 모드 활성화
  if (imageFiles.length > 1) {
    isBatchMode.value = true
  } else {
    isBatchMode.value = false
  }
  
  // 첫 번째 이미지로 시작
  currentImageIndex.value = 0
  startProcessingImage(0)
  return true
}

/**
 * 파일 선택 처리 (컴포넌트에서 emit으로 받음)
 */
const handleFilesSelected = (files) => {
  initializeImageList(files)
}

// ==================== 이미지 관리 함수 ====================
/**
 * 특정 인덱스의 이미지 처리 시작
 */
const startProcessingImage = (index) => {
  if (index < 0 || index >= imageList.value.length) return
  
  currentImageIndex.value = index
  const imageItem = imageList.value[index]
  
  // 이전 이미지 URL 정리
  if (imageUrl.value && imageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(imageUrl.value)
  }
  
  // 현재 이미지 URL은 항상 새로 생성하여 revoke된 URL 문제 방지
  if (imageItem.url && imageItem.url.startsWith('blob:')) {
    try { URL.revokeObjectURL(imageItem.url) } catch (e) {}
  }
  imageItem.url = URL.createObjectURL(imageItem.file)
  
  selectedFile.value = imageItem.file
  imageUrl.value = imageItem.url
  points.value = []
  
  // 일괄 처리 모드인 경우
  if (isBatchMode.value) {
    if (index === 0) {
      // 첫 번째 이미지: 선분 초기화하고 그리기 가능 (단, 이미 선분이 있으면 유지)
      if (sharedLines.value.length === 0) {
        // sharedLines가 비어있을 때만 초기화
        lines.value = []
        lineIdCounter.value = 0
        baseImageDisplaySize.value = { width: 0, height: 0 }
        baseImageNaturalSize.value = { width: 0, height: 0 }
      } else {
        // 이미 선분이 있으면 sharedLines를 lines에 복사
        lines.value = [...sharedLines.value]
      }
    } else {
      // 나머지 이미지: 공유된 선분을 현재 이미지 화면 크기에 맞게 조정
      if (sharedLines.value.length > 0) {
        lines.value = adjustLinesToDisplaySize(sharedLines.value, baseImageDisplaySize.value)
      } else {
        lines.value = []
      }
    }
  } else {
    // 일반 모드: 선분 초기화
    lines.value = []
    lineIdCounter.value = 0
  }
  
  // 즉시 draw 단계로 전환 (이미지 로딩은 컴포넌트에서 처리)
  currentStep.value = 'draw'
}

// 드래그 관련 함수들은 ImageUpload 컴포넌트로 이동됨

// ==================== 선분 관리 함수 (ImageDraw 컴포넌트에서 emit으로 받음) ====================
/**
 * 선분 추가 (컴포넌트에서 emit으로 받음)
 */
const handleLineAdded = (newLine) => {
  lines.value.push(newLine)
  
  // 일괄 처리 모드이고 첫 번째 이미지인 경우 공유 선분에 추가
  if (isBatchMode.value && currentImageIndex.value === 0) {
    sharedLines.value.push({ ...newLine })
  }
}

/**
 * 선분 업데이트 (컴포넌트에서 emit으로 받음)
 */
const handleLineUpdated = (updatedLine) => {
  const index = lines.value.findIndex(l => l.id === updatedLine.id)
  if (index !== -1) {
    lines.value[index] = updatedLine
  }
  
  // 일괄 처리 모드이고 첫 번째 이미지인 경우 공유 선분도 업데이트
  if (isBatchMode.value && currentImageIndex.value === 0) {
    const sharedIndex = sharedLines.value.findIndex(l => l.id === updatedLine.id)
    if (sharedIndex !== -1) {
      sharedLines.value[sharedIndex] = { ...updatedLine }
    }
  }
}

/**
 * 선분 복사 (컴포넌트에서 emit으로 받음)
 */
const handleLineDuplicated = (newLine) => {
  lines.value.push(newLine)
  
  // 일괄 처리 모드이고 첫 번째 이미지인 경우 공유 선분에 추가
  if (isBatchMode.value && currentImageIndex.value === 0) {
    sharedLines.value.push({ ...newLine })
  }
}

/**
 * 선분 삭제 (컴포넌트에서 emit으로 받음)
 */
const handleLineDeleted = (lineId) => {
  const index = lines.value.findIndex(l => l.id === lineId)
  if (index !== -1) {
    lines.value.splice(index, 1)
  }
  
  // 일괄 처리 모드이고 첫 번째 이미지인 경우 공유 선분도 삭제
  if (isBatchMode.value && currentImageIndex.value === 0) {
    const sharedIndex = sharedLines.value.findIndex(l => l.id === lineId)
    if (sharedIndex !== -1) {
      sharedLines.value.splice(sharedIndex, 1)
    }
  }
}

const handleLineSelected = (lineId) => {
  selectedLineId.value = lineId
}

// ==================== 교점 계산 함수 ====================
/**
 * 두 선분의 교점 계산
 */
const getLineIntersection = (line1, line2) => {
  const { start: p1, end: p2 } = line1
  const { start: p3, end: p4 } = line2
  
  // 수평선과 수직선 교점 계산 최적화
  if (line1.type === 'horizontal' && line2.type === 'vertical') {
    // line1은 수평선 (y가 일정), line2는 수직선 (x가 일정)
    const y = p1.y // 수평선의 y 좌표
    const x = p3.x // 수직선의 x 좌표
    
    // 선분 범위 내에 있는지 확인
    const hMinX = Math.min(p1.x, p2.x)
    const hMaxX = Math.max(p1.x, p2.x)
    const vMinY = Math.min(p3.y, p4.y)
    const vMaxY = Math.max(p3.y, p4.y)
    
    if (x >= hMinX && x <= hMaxX && y >= vMinY && y <= vMaxY) {
      return { x, y }
    }
    return null
  } else if (line1.type === 'vertical' && line2.type === 'horizontal') {
    // line1은 수직선 (x가 일정), line2는 수평선 (y가 일정)
    const x = p1.x // 수직선의 x 좌표
    const y = p3.y // 수평선의 y 좌표
    
    // 선분 범위 내에 있는지 확인
    const vMinY = Math.min(p1.y, p2.y)
    const vMaxY = Math.max(p1.y, p2.y)
    const hMinX = Math.min(p3.x, p4.x)
    const hMaxX = Math.max(p3.x, p4.x)
    
    if (x >= hMinX && x <= hMaxX && y >= vMinY && y <= vMaxY) {
      return { x, y }
    }
    return null
  }
  
  // 일반적인 경우: 기존 로직 사용
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x)
  if (Math.abs(denom) < 0.001) return null // 평행한 선분
  
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom
  const s = ((p1.x - p3.x) * (p1.y - p2.y) - (p1.y - p3.y) * (p1.x - p2.x)) / denom
  
  // t와 s가 0~1 범위 내에 있어야 선분 위의 교점
  if (t >= 0 && t <= 1 && s >= 0 && s <= 1) {
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y)
    }
  }
  
  return null
}

/**
 * 4개 선분의 교점 계산 (수평 2개, 수직 2개)
 * @param {Array} linesToUse - 사용할 선분 배열 (선택적, 없으면 lines.value 사용)
 */
const calculateIntersections = (linesToUse = null) => {
  const currentLines = linesToUse || lines.value
  
  if (currentLines.length !== 4) return []
  
  const horizontalLines = currentLines.filter(l => l.type === 'horizontal')
  const verticalLines = currentLines.filter(l => l.type === 'vertical')
  
  if (horizontalLines.length !== 2 || verticalLines.length !== 2) return []
  
  const intersections = []
  
  // 수평선과 수직선의 교점 계산
  for (const hLine of horizontalLines) {
    for (const vLine of verticalLines) {
      const intersection = getLineIntersection(hLine, vLine)
      if (intersection) {
        intersections.push(intersection)
      }
    }
  }
  
  // 교점을 정렬 (좌상, 우상, 좌하, 우하 순서)
  intersections.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 10) {
      return a.y - b.y // y 좌표로 먼저 정렬
    }
    return a.x - b.x // x 좌표로 정렬
  })
  
  return intersections
}

/**
 * 4개 선분의 교점 계산 (linesToUse 필수)
 * @param {Array} linesToUse - 사용할 선분 배열
 */
const calculateIntersectionsWithLines = (linesToUse) => {
  return calculateIntersections(linesToUse)
}

/**
 * 현재 처리에 사용할 이미지 요소 찾기
 */
const getProcessingImageElement = () => {
  let img = null
  if (imageDrawRef.value?.imageRef) {
    const ref = imageDrawRef.value.imageRef
    if (typeof ref === 'object' && ref !== null && 'value' in ref) {
      img = ref.value
    } else {
      img = ref
    }
  }

  if (!img) {
    img = imageRef.value
  }

  return img
}

/**
 * 선분을 실제 이미지 좌표계의 교점으로 변환
 */
const convertLinesToImageCorners = (linesSource, imgElement) => {
  if (!imgElement) return null

  const currentLines = linesSource || lines.value
  const rawCorners = calculateIntersectionsWithLines(currentLines)
  const corners = orderCornersClockwise(rawCorners)

  if (!corners || corners.length !== 4) {
    return null
  }

  const imgDisplayWidth = imgElement.offsetWidth || imgElement.width
  const imgDisplayHeight = imgElement.offsetHeight || imgElement.height
  const imgNaturalWidth = imgElement.naturalWidth || imgElement.width
  const imgNaturalHeight = imgElement.naturalHeight || imgElement.height

  if (imgDisplayWidth === 0 || imgDisplayHeight === 0) {
    return null
  }

  let imgOffsetX = 0
  let imgOffsetY = 0
  const wrapper = imageDrawRef.value?.$el?.querySelector?.('.image-wrapper')
  if (wrapper) {
    const wrapperRect = wrapper.getBoundingClientRect()
    const imgRect = imgElement.getBoundingClientRect()
    imgOffsetX = imgRect.left - wrapperRect.left
    imgOffsetY = imgRect.top - wrapperRect.top
  }

  if (imgOffsetX === 0 && imgOffsetY === 0) {
    imgOffsetX = 20
    imgOffsetY = 20
  }

  const scaleX = imgNaturalWidth / imgDisplayWidth
  const scaleY = imgNaturalHeight / imgDisplayHeight

  const cornersInImage = corners.map((corner) => {
    const relativeX = corner.x - imgOffsetX
    const relativeY = corner.y - imgOffsetY
    const clampedX = Math.max(0, Math.min(relativeX, imgDisplayWidth))
    const clampedY = Math.max(0, Math.min(relativeY, imgDisplayHeight))
    return {
      x: clampedX * scaleX,
      y: clampedY * scaleY
    }
  })

  return {
    cornersInImage,
    meta: {
      imgDisplayWidth,
      imgDisplayHeight,
      imgNaturalWidth,
      imgNaturalHeight,
      scaleX,
      scaleY,
      imgOffsetX,
      imgOffsetY
    }
  }
}

/**
 * 코너 정보를 기반으로 출력 사이즈와 크롭 영역 계산
 */
const calculateCropMetrics = (cornersInImage, imgNaturalWidth, imgNaturalHeight) => {
  const w1 = Math.sqrt(Math.pow(cornersInImage[1].x - cornersInImage[0].x, 2) + Math.pow(cornersInImage[1].y - cornersInImage[0].y, 2))
  const w2 = Math.sqrt(Math.pow(cornersInImage[2].x - cornersInImage[3].x, 2) + Math.pow(cornersInImage[2].y - cornersInImage[3].y, 2))
  const h1 = Math.sqrt(Math.pow(cornersInImage[3].x - cornersInImage[0].x, 2) + Math.pow(cornersInImage[3].y - cornersInImage[0].y, 2))
  const h2 = Math.sqrt(Math.pow(cornersInImage[2].x - cornersInImage[1].x, 2) + Math.pow(cornersInImage[2].y - cornersInImage[1].y, 2))

  const avgWidth = (w1 + w2) / 2
  const avgHeight = (h1 + h2) / 2
  const avgSize = (avgWidth + avgHeight) / 2
  const minSize = Math.max(imgNaturalWidth, imgNaturalHeight) * 0.3
  const width = Math.max(avgSize || minSize, minSize, 300)
  const height = Math.max(avgSize || minSize, minSize, 300)

  const allX = cornersInImage.map((point) => point.x)
  const allY = cornersInImage.map((point) => point.y)

  const minX = Math.max(0, Math.floor(Math.min(...allX) - 1))
  const maxX = Math.min(imgNaturalWidth, Math.ceil(Math.max(...allX) + 1))
  const minY = Math.max(0, Math.floor(Math.min(...allY) - 1))
  const maxY = Math.min(imgNaturalHeight, Math.ceil(Math.max(...allY) + 1))

  const cropWidth = maxX - minX
  const cropHeight = maxY - minY

  return {
    width,
    height,
    minX,
    minY,
    cropWidth,
    cropHeight
  }
}

/**
 * 주어진 이미지와 코너로 크롭/리사이즈 수행
 */
const cropImageWithCorners = (imgElement, cornersInImage) => {
  const imgNaturalWidth = imgElement.naturalWidth || imgElement.width
  const imgNaturalHeight = imgElement.naturalHeight || imgElement.height
  const metrics = calculateCropMetrics(cornersInImage, imgNaturalWidth, imgNaturalHeight)

  if (metrics.cropWidth <= 0 || metrics.cropHeight <= 0) {
    throw new Error('Invalid crop area: ' + JSON.stringify(metrics))
  }

  const canvas = document.createElement('canvas')
  canvas.width = metrics.width
  canvas.height = metrics.height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = COLORS.BACKGROUND
  ctx.fillRect(0, 0, metrics.width, metrics.height)
  ctx.drawImage(
    imgElement,
    metrics.minX,
    metrics.minY,
    metrics.cropWidth,
    metrics.cropHeight,
    0,
    0,
    metrics.width,
    metrics.height
  )

  return canvas.toDataURL('image/png')
}

/**
 * 파일에서 이미지를 비동기로 로드
 */
const loadImageFromFile = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('파일이 없습니다.'))
      return
    }

    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      resolve(img)
    }
    img.onerror = (error) => {
      URL.revokeObjectURL(img.src)
      reject(error)
    }
    img.src = URL.createObjectURL(file)
  })
}

/**
 * 교점 4개를 시계 방향(좌상 → 우상 → 우하 → 좌하)으로 정렬
 */
const orderCornersClockwise = (points) => {
  if (!points || points.length !== 4) return points
  
  // 중심점 계산
  const center = points.reduce((acc, point) => ({
    x: acc.x + point.x,
    y: acc.y + point.y
  }), { x: 0, y: 0 })
  center.x /= points.length
  center.y /= points.length
  
  // 각도 기준 정렬 (atan2 결과: -π ~ π, 시계 방향)
  const ordered = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - center.y, a.x - center.x)
    const angleB = Math.atan2(b.y - center.y, b.x - center.x)
    return angleA - angleB
  })
  
  // 시작점을 좌상단 (x + y가 가장 작은 점)으로 맞추기 위해 rotate
  let startIndex = 0
  let minSum = Infinity
  ordered.forEach((point, index) => {
    const sum = point.x + point.y
    if (sum < minSum) {
      minSum = sum
      startIndex = index
    }
  })
  
  const rotated = []
  for (let i = 0; i < ordered.length; i++) {
    rotated.push(ordered[(startIndex + i) % ordered.length])
  }
  
  // 현재 정렬은 좌상 → 우상 → 우하 → 좌하
  return rotated
}

// ==================== 이미지 보정 관련 함수 ====================
/**
 * 이미지 보정 시작
 */
const handleCorrection = () => {
  if (lines.value.length !== CONSTANTS.REQUIRED_LINES) {
    alert(`${CONSTANTS.REQUIRED_LINES}개의 선분(수평 ${CONSTANTS.REQUIRED_HORIZONTAL}개, 수직 ${CONSTANTS.REQUIRED_VERTICAL}개)을 그려주세요.`)
    return
  }
  
  const horizontalLines = lines.value.filter(l => l.type === 'horizontal')
  const verticalLines = lines.value.filter(l => l.type === 'vertical')
  
  if (horizontalLines.length !== CONSTANTS.REQUIRED_HORIZONTAL || verticalLines.length !== CONSTANTS.REQUIRED_VERTICAL) {
    alert(`수평선 ${CONSTANTS.REQUIRED_HORIZONTAL}개와 수직선 ${CONSTANTS.REQUIRED_VERTICAL}개를 그려주세요.`)
    return
  }
  
  // 이미지가 완전히 로드될 때까지 대기
  const processImage = () => {
    // ImageDraw 컴포넌트의 imageRef 사용
    // imageRef가 RefImpl이면 .value로, 이미 unwrapped면 직접 사용
    let img = null
    if (imageDrawRef.value?.imageRef) {
      // RefImpl인지 확인 (value 속성이 있고 함수가 아닌 경우)
      if (typeof imageDrawRef.value.imageRef === 'object' && 'value' in imageDrawRef.value.imageRef) {
        img = imageDrawRef.value.imageRef.value
      } else {
        // 이미 unwrapped된 경우
        img = imageDrawRef.value.imageRef
      }
    }
    
    // 폴백: App.vue의 imageRef 사용
    if (!img) {
      img = imageRef.value
    }
    
    console.log('이미지 찾기 시도:', {
      imageDrawRef: imageDrawRef.value,
      imageRef: imageDrawRef.value?.imageRef,
      imageRefType: typeof imageDrawRef.value?.imageRef,
      hasValue: 'value' in (imageDrawRef.value?.imageRef || {}),
      img: img,
      fallbackImageRef: imageRef.value
    })
    
    if (!img) {
      console.error('이미지를 찾을 수 없습니다. imageDrawRef:', imageDrawRef.value)
      alert('이미지를 찾을 수 없습니다.')
      return
    }
    
    if (!img.complete) {
      img.onload = processImage
      return
    }
    
    nextTick(() => {
      try {
        applyPerspectiveTransform()
        
        // 처리된 이미지 저장
        if (currentImageIndex.value >= 0 && currentImageIndex.value < imageList.value.length) {
          imageList.value[currentImageIndex.value].processedUrl = imageUrl.value
          processedImages.value[currentImageIndex.value] = imageUrl.value
        }
        
        currentStep.value = 'result'
      } catch (error) {
        console.error('보정 중 오류 발생:', error)
        alert('이미지 보정 중 오류가 발생했습니다: ' + error.message)
        resetProcess()
      }
    })
  }
  
  processImage()
}

/**
 * 원근 변환 적용
 * @param {Array} linesToUse - 사용할 선분 배열 (선택적, 없으면 lines.value 사용)
 */
const applyPerspectiveTransform = (linesToUse = null) => {
  // linesToUse가 제공되지 않으면 기본값으로 lines.value 사용
  const currentLines = linesToUse || lines.value
  
  console.log('보정 시작, 선분 개수:', currentLines.length)
  const img = getProcessingImageElement()
  
  console.log('applyPerspectiveTransform 이미지 찾기:', {
    imageDrawRef: imageDrawRef.value,
    imageRef: imageDrawRef.value?.imageRef,
    imageRefType: typeof imageDrawRef.value?.imageRef,
    hasValue: 'value' in (imageDrawRef.value?.imageRef || {}),
    img: img,
    found: !!img
  })
  
  if (!img) {
    console.error('이미지가 없습니다')
    return
  }

  const conversion = convertLinesToImageCorners(currentLines, img)

  if (!conversion) {
    console.error('교점을 계산할 수 없습니다. 선분:', currentLines)
    alert('4개의 교점을 계산할 수 없습니다. 수평선 2개와 수직선 2개가 교차하는지 확인해주세요.')
    return
  }

  const dataUrl = cropImageWithCorners(img, conversion.cornersInImage)
  imageUrl.value = dataUrl
  console.log('이미지 변환 완료, 데이터 URL 길이:', dataUrl.length)

  if (dataUrl.length < CONSTANTS.MIN_DATA_URL_LENGTH) {
    console.warn('⚠️ 생성된 이미지 데이터가 너무 작습니다. 크롭 영역을 확인해주세요.')
  }
}

const resetProcess = () => {
  // 모든 이미지 URL 정리
  imageList.value.forEach(item => {
    if (item.url && item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url)
    }
  })
  if (imageUrl.value && imageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(imageUrl.value)
  }
  
  currentStep.value = 'upload'
  selectedFile.value = null
  imageUrl.value = null
  points.value = []
  currentLine.value = null
  lines.value = []
  lineIdCounter.value = 0
  imageList.value = []
  currentImageIndex.value = -1
  processedImages.value = []
  isBatchMode.value = false
  sharedLines.value = []
  baseImageDisplaySize.value = { width: 0, height: 0 }
  baseImageNaturalSize.value = { width: 0, height: 0 }
  isProcessingAll.value = false
  processingProgress.value = { current: 0, total: 0 }
}

/**
 * 다음 이미지로 이동
 */
const nextImage = () => {
  if (currentImageIndex.value < imageList.value.length - 1) {
    const nextIndex = currentImageIndex.value + 1
    if (showProcessedResult(nextIndex)) {
      return
    }
    startProcessingImage(nextIndex)
  }
}

/**
 * 이전 이미지로 이동
 */
const previousImage = () => {
  if (currentImageIndex.value > 0) {
    const prevIndex = currentImageIndex.value - 1
    if (showProcessedResult(prevIndex)) {
      return
    }
    startProcessingImage(prevIndex)
  }
}

/**
 * 현재 이미지 다시 처리
 */
const reprocessCurrentImage = () => {
  startProcessingImage(currentImageIndex.value)
}

/**
 * 이미 처리된 이미지 결과를 화면에 표시
 */
const showProcessedResult = (index) => {
  if (index < 0 || index >= imageList.value.length) return false
  const processedUrl = imageList.value[index]?.processedUrl
  if (!processedUrl) return false

  currentImageIndex.value = index
  imageUrl.value = processedUrl
  currentStep.value = 'result'
  return true
}

/**
 * 선분을 화면 표시 크기에 맞게 조정 (화면 좌표 기준)
 */
const adjustLinesToDisplaySize = (sourceLines, sourceDisplaySize, targetDisplaySize = null) => {
  if (!targetDisplaySize) {
    // targetDisplaySize가 없으면 현재 이미지 화면 크기 사용
    if (!imageDrawRef.value?.imageRef) return sourceLines
    
    let img = null
    if (imageDrawRef.value.imageRef) {
      if (typeof imageDrawRef.value.imageRef === 'object' && 'value' in imageDrawRef.value.imageRef) {
        img = imageDrawRef.value.imageRef.value
      } else {
        img = imageDrawRef.value.imageRef
      }
    }
    
    if (!img || !img.complete) return sourceLines
    
    targetDisplaySize = {
      width: img.offsetWidth || img.width,
      height: img.offsetHeight || img.height
    }
  }
  
  if (sourceDisplaySize.width === 0 || sourceDisplaySize.height === 0) return sourceLines
  
  const scaleX = targetDisplaySize.width / sourceDisplaySize.width
  const scaleY = targetDisplaySize.height / sourceDisplaySize.height
  
  return sourceLines.map(line => ({
    ...line,
    start: {
      x: line.start.x * scaleX,
      y: line.start.y * scaleY
    },
    end: {
      x: line.end.x * scaleX,
      y: line.end.y * scaleY
    }
  }))
}

/**
 * 기준 이미지 크기 저장 (첫 번째 이미지 로드 시) - 화면 표시 크기와 자연 크기 모두 저장
 */
const saveBaseImageSize = (size = null) => {
  if (size) {
    baseImageNaturalSize.value = size
    return
  }
  
  if (!imageDrawRef.value?.imageRef) return
  
  let img = null
  if (imageDrawRef.value.imageRef) {
    if (typeof imageDrawRef.value.imageRef === 'object' && 'value' in imageDrawRef.value.imageRef) {
      img = imageDrawRef.value.imageRef.value
    } else {
      img = imageDrawRef.value.imageRef
    }
  }
  
  if (img && img.complete) {
    baseImageDisplaySize.value = {
      width: img.offsetWidth || img.width,
      height: img.offsetHeight || img.height
    }
    baseImageNaturalSize.value = {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height
    }
  }
}

/**
 * 이미지 로드 완료 핸들러
 */
const handleImageLoaded = (size) => {
  if (isBatchMode.value && currentImageIndex.value === 0) {
    saveBaseImageSize(size)
  }
}

/**
 * 모든 이미지를 한 번에 처리
 */
const processAllImages = async () => {
  if (!isBatchMode.value) {
    alert('일괄 처리 모드가 활성화되어 있지 않습니다.')
    return
  }
  
  if (sharedLines.value.length !== CONSTANTS.REQUIRED_LINES) {
    alert(`${CONSTANTS.REQUIRED_LINES}개의 선분(수평 ${CONSTANTS.REQUIRED_HORIZONTAL}개, 수직 ${CONSTANTS.REQUIRED_VERTICAL}개)을 그려주세요.`)
    return
  }
  
  const horizontalLines = sharedLines.value.filter(l => l.type === 'horizontal')
  const verticalLines = sharedLines.value.filter(l => l.type === 'vertical')
  
  if (horizontalLines.length !== CONSTANTS.REQUIRED_HORIZONTAL || verticalLines.length !== CONSTANTS.REQUIRED_VERTICAL) {
    alert(`수평선 ${CONSTANTS.REQUIRED_HORIZONTAL}개와 수직선 ${CONSTANTS.REQUIRED_VERTICAL}개를 그려주세요.`)
    return
  }
  
  // 기준 이미지 크기 저장
  saveBaseImageSize()

  const baseImgElement = getProcessingImageElement()
  if (!baseImgElement) {
    alert('기준 이미지를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.')
    return
  }

  const conversion = convertLinesToImageCorners(sharedLines.value, baseImgElement)
  if (!conversion) {
    alert('기준 이미지에서 교점을 계산할 수 없습니다. 선분을 확인해주세요.')
    return
  }

  const baseNaturalWidth = baseImgElement.naturalWidth || baseImgElement.width
  const baseNaturalHeight = baseImgElement.naturalHeight || baseImgElement.height

  if (!baseNaturalWidth || !baseNaturalHeight) {
    alert('기준 이미지 크기를 확인할 수 없습니다.')
    return
  }

  const normalizedCorners = conversion.cornersInImage.map((point) => ({
    x: point.x / baseNaturalWidth,
    y: point.y / baseNaturalHeight
  }))

  // 처리 시작
  isProcessingAll.value = true
  processingProgress.value = { current: 0, total: imageList.value.length }

  try {
    for (let i = 0; i < imageList.value.length; i++) {
      processingProgress.value.current = i + 1
      const imageItem = imageList.value[i]

      try {
        const imgElement = await loadImageFromFile(imageItem.file)
        const naturalWidth = imgElement.naturalWidth || imgElement.width
        const naturalHeight = imgElement.naturalHeight || imgElement.height

        const targetCorners = normalizedCorners.map((corner) => ({
          x: corner.x * naturalWidth,
          y: corner.y * naturalHeight
        }))

        const dataUrl = cropImageWithCorners(imgElement, targetCorners)
        imageItem.processedUrl = dataUrl
        processedImages.value[i] = dataUrl
        console.log(`이미지 ${i + 1} 처리 완료`)
      } catch (error) {
        console.error(`이미지 ${i + 1} 처리 중 오류:`, error)
        imageItem.processedUrl = null
      }

      await nextTick()
    }

    const firstProcessedIndex = imageList.value.findIndex((item) => item.processedUrl)
    if (firstProcessedIndex >= 0) {
      currentImageIndex.value = firstProcessedIndex
      imageUrl.value = imageList.value[firstProcessedIndex].processedUrl
      currentStep.value = 'result'
      console.log('결과 페이지로 전환 완료:', {
        index: currentImageIndex.value,
        imageUrl: imageUrl.value,
        processedUrl: imageList.value[firstProcessedIndex].processedUrl
      })
    } else {
      console.error('처리된 이미지가 없습니다.')
      alert('이미지 처리 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  } finally {
    isProcessingAll.value = false
    processingProgress.value = { current: 0, total: 0 }
  }
}

/**
 * 일괄 처리 모드 토글
 */
const toggleBatchMode = () => {
  isBatchMode.value = !isBatchMode.value
  
  if (isBatchMode.value) {
    // 일괄 처리 모드 활성화: 첫 번째 이미지로 이동
    if (imageList.value.length > 0) {
      startProcessingImage(0)
    }
  } else {
    // 일괄 처리 모드 비활성화: 공유 선분 초기화
    sharedLines.value = []
    baseImageDisplaySize.value = { width: 0, height: 0 }
    baseImageNaturalSize.value = { width: 0, height: 0 }
  }
}

// ==================== Computed 속성 ====================
/**
 * 전체 완료 여부 확인
 */
const isAllProcessed = computed(() => {
  return imageList.value.length > 0 && 
         imageList.value.every(item => item.processedUrl !== null)
})

/**
 * 진행률 계산
 */
const progressPercentage = computed(() => {
  if (imageList.value.length === 0) return 0
  const processedCount = imageList.value.filter(item => item.processedUrl !== null).length
  return Math.round((processedCount / imageList.value.length) * 100)
})

// ==================== 이미지 저장 및 다운로드 함수 ====================
/**
 * 현재 이미지 저장
 */
const saveImage = () => {
  const link = document.createElement('a')
  const fileName = currentImageInfo.value.name
    ? `corrected-${currentImageInfo.value.name}`
    : 'corrected-image.png'
  link.download = fileName
  link.href = imageUrl.value
  link.click()
}

/**
 * 모든 이미지 다운로드 (Electron 환경에서는 폴더에 저장, 웹에서는 개별 다운로드)
 */
const downloadAllImages = async () => {
  // Electron 환경 확인
  if (window.electronAPI) {
    try {
      // 폴더 선택 다이얼로그
      const folderPath = await window.electronAPI.selectFolder()
      
      if (!folderPath) {
        // 사용자가 취소한 경우
        return
      }
      
      // 저장할 파일 목록 준비
      const filesToSave = imageList.value
        .filter(item => item.processedUrl)
        .map(item => ({
          name: `corrected-${item.name}`,
          data: item.processedUrl
        }))
      
      if (filesToSave.length === 0) {
        alert('저장할 이미지가 없습니다.')
        return
      }
      
      // 파일 저장
      const result = await window.electronAPI.saveFiles(folderPath, filesToSave)
      
      if (result.success) {
        const successCount = result.results.filter(r => r.success).length
        const failCount = result.results.filter(r => !r.success).length
        
        if (failCount === 0) {
          alert(`모든 이미지(${successCount}개)가 성공적으로 저장되었습니다.`)
        } else {
          alert(`${successCount}개 저장 성공, ${failCount}개 저장 실패`)
        }
      } else {
        alert('이미지 저장 중 오류가 발생했습니다: ' + (result.error || '알 수 없는 오류'))
      }
    } catch (error) {
      console.error('이미지 저장 오류:', error)
      alert('이미지 저장 중 오류가 발생했습니다: ' + error.message)
    }
  } else {
    // 웹 환경: 기존 방식으로 개별 다운로드
    imageList.value.forEach((item, index) => {
      if (item.processedUrl) {
        setTimeout(() => {
          const link = document.createElement('a')
          const fileName = `corrected-${item.name}`
          link.download = fileName
          link.href = item.processedUrl
          link.click()
        }, index * 200) // 각 다운로드를 약간씩 지연시켜 순차적으로 처리
      }
    })
  }
}

/**
 * 사용자 안내 메시지
 */
const showInstruction = computed(() => {
  const horizontalCount = lines.value.filter(l => l.type === 'horizontal').length
  const verticalCount = lines.value.filter(l => l.type === 'vertical').length
  
  if (lines.value.length === 0) {
    return '첫 번째 점을 클릭하여 선분을 시작하세요'
  }
  if (horizontalCount === 0) {
    return '수평선을 그려주세요 (첫 번째 점 클릭 → 마우스 이동 → 두 번째 점 클릭)'
  }
  if (horizontalCount === 1) {
    return '두 번째 수평선을 그려주세요 (또는 기존 선분을 복사하여 평행하게 이동)'
  }
  if (verticalCount === 0) {
    return '수직선을 그려주세요 (첫 번째 점 클릭 → 마우스 이동 → 두 번째 점 클릭)'
  }
  if (verticalCount === 1) {
    return '두 번째 수직선을 그려주세요 (또는 기존 선분을 복사하여 평행하게 이동)'
  }
  if (lines.value.length === 4) {
    return '4개의 선분이 완성되었습니다. 선분을 드래그하여 위치를 조정한 후 보정 버튼을 클릭하세요'
  }
  return '선분을 드래그하여 위치를 조정하거나, 선분을 복사하여 평행한 선분을 만드세요'
})

/**
 * 현재 이미지 정보
 */
const currentImageInfo = computed(() => {
  if (currentImageIndex.value < 0 || currentImageIndex.value >= imageList.value.length) {
    return { name: '', index: 0, total: 0 }
  }
  return {
    name: imageList.value[currentImageIndex.value].name,
    index: currentImageIndex.value + 1,
    total: imageList.value.length
  }
})
</script>

<template>
  <!-- 업로드 단계 -->
  <ImageUpload v-if="currentStep === 'upload'" @files-selected="handleFilesSelected" />

  <!-- 선 그리기 단계 -->
  <ImageDraw
    v-if="currentStep === 'draw'"
    ref="imageDrawRef"
    :image-url="imageUrl"
    :lines="lines"
    :selected-line-id="selectedLineId"
    :current-image-info="currentImageInfo"
    :progress-percentage="progressPercentage"
    :image-list-length="imageList.length"
    :instruction="showInstruction"
    :is-batch-mode="isBatchMode"
    :is-read-only="isBatchMode && currentImageIndex !== 0"
    :is-processing-all="isProcessingAll"
    :processing-progress="processingProgress"
    @line-added="handleLineAdded"
    @line-updated="handleLineUpdated"
    @line-duplicated="handleLineDuplicated"
    @line-deleted="handleLineDeleted"
    @select-line="handleLineSelected"
    @correction="handleCorrection"
    @reset="resetProcess"
    @next="nextImage"
    @previous="previousImage"
    @process-all="processAllImages"
    @toggle-batch-mode="toggleBatchMode"
    @image-loaded="handleImageLoaded"
  />

  <!-- 결과 확인 단계 -->
  <ImageResult
    v-if="currentStep === 'result'"
    :image-url="imageUrl"
    :current-image-info="currentImageInfo"
    :progress-percentage="progressPercentage"
    :image-list-length="imageList.length"
    :is-all-processed="isAllProcessed"
    @save="saveImage"
    @reprocess="reprocessCurrentImage"
    @next="nextImage"
    @previous="previousImage"
    @reset="resetProcess"
    @download-all="downloadAllImages"
  />
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

.upload-area {
  width: 100%;
  max-width: 600px;
  min-height: 300px;
  border: 2px dashed #444;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  transition: all 0.3s ease;
  background-color: #1e1e1e;
}

.upload-area:hover {
  border-color: #646cff;
  background-color: #242424;
}

.upload-area.drag-over {
  border-color: #646cff;
  background-color: #2a2a2a;
  transform: scale(1.02);
}

.upload-icon {
  color: #ffffff;
  margin-bottom: 2rem;
}

.upload-text {
  font-size: 1rem;
  color: #888;
  margin-bottom: 1rem;
}

.upload-hint {
  font-size: 0.875rem;
  color: #646cff;
  margin-bottom: 1.5rem;
  font-style: italic;
}

.choose-file-btn, .save-btn {
  background-color: #646cff;
  color: #ffffff;
  border: none;
  padding: 0.875rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.choose-file-btn:hover, .save-btn:hover {
  background-color: #535bf2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.3);
}

.choose-file-btn:active, .save-btn:active {
  transform: translateY(0);
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
}

.line-item-hovered {
  background-color: #333;
  border: 1px solid #646cff;
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

.image-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #1e1e1e;
  border-radius: 8px;
  border: 1px solid #333;
}

.nav-btn {
  background-color: #646cff;
  color: #ffffff;
  border: none;
  padding: 0.625rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.nav-btn:hover:not(:disabled) {
  background-color: #535bf2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.3);
}

.nav-btn:disabled {
  background-color: #333;
  color: #666;
  cursor: not-allowed;
  opacity: 0.5;
}

.nav-info {
  color: #ffffff;
  font-size: 1rem;
  font-weight: 600;
  min-width: 80px;
  text-align: center;
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

.result-area {
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.result-image {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  margin-bottom: 2rem;
}

.button-group {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.next-btn, .prev-btn {
  background-color: #646cff;
  color: #ffffff;
  border: none;
  padding: 0.875rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.next-btn:hover, .prev-btn:hover {
  background-color: #535bf2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.3);
}

.restart-btn {
  background-color: #f59e0b;
  color: #ffffff;
  border: none;
  padding: 0.875rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.restart-btn:hover {
  background-color: #d97706;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.restart-btn:active {
  transform: translateY(0);
}

.completion-message {
  margin-top: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, #646cff20, #535bf220);
  border-radius: 12px;
  border: 2px solid #646cff;
  text-align: center;
}

.completion-text {
  font-size: 1.25rem;
  color: #ffffff;
  margin-bottom: 1.5rem;
  font-weight: 600;
}

.download-all-btn {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #ffffff;
  border: none;
  padding: 1rem 2.5rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.download-all-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4);
}

.reset-btn-white {
  background-color: #ffffff;
  color: #1a1a1a;
  border: none;
  padding: 0.875rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.reset-btn-white:hover {
  background-color: #f0f0f0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.2);
}

.reset-btn-white:active {
  transform: translateY(0);
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
  
  .upload-area {
    min-height: 250px;
    padding: 2rem;
  }
  
  .decoration {
    display: none;
  }

  .button-group {
    flex-direction: column;
    width: 100%;
  }

  .choose-file-btn, .save-btn, .reset-btn, .reset-btn-white, .next-btn, .prev-btn, .restart-btn {
    width: 100%;
  }
  
  .image-navigation {
    flex-direction: column;
    gap: 1rem;
  }
  
  .progress-info {
    max-width: 100%;
  }
}
</style>

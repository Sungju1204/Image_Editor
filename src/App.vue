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

// 여러 이미지 처리 관련 상태
const imageList = ref([]) // 업로드된 모든 이미지 파일
const currentImageIndex = ref(-1) // 현재 처리 중인 이미지 인덱스
const processedImages = ref([]) // 처리 완료된 이미지들 (결과 URL 저장)

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
  
  // 현재 이미지 URL 생성 (필요할 때만)
  if (!imageItem.url) {
    imageItem.url = URL.createObjectURL(imageItem.file)
  }
  
  selectedFile.value = imageItem.file
  imageUrl.value = imageItem.url
  points.value = []
  lines.value = [] // 선분 초기화
  lineIdCounter.value = 0
  
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
}

/**
 * 선분 업데이트 (컴포넌트에서 emit으로 받음)
 */
const handleLineUpdated = (updatedLine) => {
  const index = lines.value.findIndex(l => l.id === updatedLine.id)
  if (index !== -1) {
    lines.value[index] = updatedLine
  }
}

/**
 * 선분 복사 (컴포넌트에서 emit으로 받음)
 */
const handleLineDuplicated = (newLine) => {
  lines.value.push(newLine)
}

/**
 * 선분 삭제 (컴포넌트에서 emit으로 받음)
 */
const handleLineDeleted = (lineId) => {
  const index = lines.value.findIndex(l => l.id === lineId)
  if (index !== -1) {
    lines.value.splice(index, 1)
  }
}

// ==================== 교점 계산 함수 ====================
/**
 * 두 선분의 교점 계산
 */
const getLineIntersection = (line1, line2) => {
  const { start: p1, end: p2 } = line1
  const { start: p3, end: p4 } = line2
  
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x)
  if (Math.abs(denom) < 0.001) return null // 평행한 선분
  
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom
  
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y)
  }
}

/**
 * 4개 선분의 교점 계산 (수평 2개, 수직 2개)
 */
const calculateIntersections = () => {
  if (lines.value.length !== 4) return []
  
  const horizontalLines = lines.value.filter(l => l.type === 'horizontal')
  const verticalLines = lines.value.filter(l => l.type === 'vertical')
  
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
        // 보정 전 원본 이미지 정보 저장 (라벨 저장용)
        const img = imageDrawRef.value?.imageRef?.value || imageDrawRef.value?.imageRef || imageRef.value
        if (img) {
          savedImageInfo.value = {
            naturalWidth: img.naturalWidth || img.width,
            naturalHeight: img.naturalHeight || img.height,
            displayWidth: img.offsetWidth,
            displayHeight: img.offsetHeight
          }
        }
        
        // 보정 전 선분 정보 저장 (라벨 저장용)
        savedLines.value = JSON.parse(JSON.stringify(lines.value))
        
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
 */
const applyPerspectiveTransform = () => {
  console.log('보정 시작, 선분 개수:', lines.value.length)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
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
  
  // 실제 이미지 원본 크기
  const imgNaturalWidth = img.naturalWidth || img.width
  const imgNaturalHeight = img.naturalHeight || img.height
  const imgDisplayWidth = img.offsetWidth
  const imgDisplayHeight = img.offsetHeight
  
  // 크기 비율 계산
  const scaleX = imgNaturalWidth / imgDisplayWidth
  const scaleY = imgNaturalHeight / imgDisplayHeight
  
  console.log('이미지 크기:', { 
    natural: { width: imgNaturalWidth, height: imgNaturalHeight },
    display: { width: imgDisplayWidth, height: imgDisplayHeight },
    scale: { x: scaleX, y: scaleY }
  })
  
  // 교점 계산 (화면 좌표)
  const corners = calculateIntersections()
  if (corners.length !== 4) {
    console.error('교점이 4개가 아닙니다:', corners.length)
    alert('4개의 교점을 계산할 수 없습니다. 선분을 다시 확인해주세요.')
    return
  }
  
  console.log('교점 (화면 좌표):', corners)
  
  // 교점을 실제 이미지 좌표로 변환
  const cornersInImage = corners.map(corner => ({
    x: corner.x * scaleX,
    y: corner.y * scaleY
  }))
  
  console.log('교점 (이미지 좌표):', cornersInImage)
  
  // 출력 크기 계산 (교점 간 거리 기반 - 이미지 좌표 기준)
  const w1 = Math.sqrt(Math.pow(cornersInImage[1].x - cornersInImage[0].x, 2) + Math.pow(cornersInImage[1].y - cornersInImage[0].y, 2))
  const w2 = Math.sqrt(Math.pow(cornersInImage[2].x - cornersInImage[3].x, 2) + Math.pow(cornersInImage[2].y - cornersInImage[3].y, 2))
  const h1 = Math.sqrt(Math.pow(cornersInImage[3].x - cornersInImage[0].x, 2) + Math.pow(cornersInImage[3].y - cornersInImage[0].y, 2))
  const h2 = Math.sqrt(Math.pow(cornersInImage[2].x - cornersInImage[1].x, 2) + Math.pow(cornersInImage[2].y - cornersInImage[1].y, 2))
  
  // 평균 크기 계산
  const avgWidth = (w1 + w2) / 2
  const avgHeight = (h1 + h2) / 2
  
  // 정사각형으로 만들기
  const avgSize = (avgWidth + avgHeight) / 2
  const width = Math.max(avgSize || 500, 100)
  const height = Math.max(avgSize || 500, 100)
  
  console.log('출력 크기:', width, 'x', height)
  
  canvas.width = width
  canvas.height = height
  
  // 실제 보정 적용
  try {
    console.log('보정 시작')
    
    // 원근 변환을 위한 소스 포인트 (이미지 좌표 기준)
    const srcPoints = [
      cornersInImage[0].x, cornersInImage[0].y, // 좌상
      cornersInImage[1].x, cornersInImage[1].y, // 우상
      cornersInImage[2].x, cornersInImage[2].y, // 우하
      cornersInImage[3].x, cornersInImage[3].y  // 좌하
    ]
    
    // 목적지 포인트 (정사각형)
    const dstPoints = [
      0, 0,           // 좌상
      width, 0,       // 우상
      width, height,  // 우하
      0, height      // 좌하
    ]
    
    console.log('소스 포인트:', srcPoints)
    console.log('목적지 포인트:', dstPoints)
    
    // Homography 행렬 계산
    const H = getPerspectiveMatrix(srcPoints, dstPoints)
    console.log('Homography 행렬:', H)
    
    // 원근 변환 적용
    ctx.fillStyle = COLORS.BACKGROUND
    ctx.fillRect(0, 0, width, height)
    
    // 일단 간단한 크롭 방식으로 시도 (원근 변환은 나중에 개선)
    ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = COLORS.BACKGROUND
      ctx.fillRect(0, 0, width, height)
    
    // 교점으로 둘러싸인 영역 계산
    const minX = Math.max(0, Math.min(...cornersInImage.map(c => c.x)))
    const maxX = Math.min(imgNaturalWidth, Math.max(...cornersInImage.map(c => c.x)))
    const minY = Math.max(0, Math.min(...cornersInImage.map(c => c.y)))
    const maxY = Math.min(imgNaturalHeight, Math.max(...cornersInImage.map(c => c.y)))
    
    const cropWidth = maxX - minX
    const cropHeight = maxY - minY
    
    console.log('크롭 영역:', { minX, minY, cropWidth, cropHeight, width, height })
    
    if (cropWidth > 0 && cropHeight > 0) {
      // 교점으로 둘러싸인 사각형 영역을 정사각형으로 스케일
      ctx.drawImage(img, minX, minY, cropWidth, cropHeight, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/png')
      imageUrl.value = dataUrl
      console.log('크롭 방식 완료, 데이터 URL 길이:', dataUrl.length)
      
      // 원근 변환도 시도해보기 (선택적)
      try {
        applyPerspective(ctx, img, H, width, height, imgNaturalWidth, imgNaturalHeight)
        const perspectiveUrl = canvas.toDataURL('image/png')
        // 원근 변환 결과가 더 좋으면 사용
        if (perspectiveUrl.length > dataUrl.length * 1.2) {
          imageUrl.value = perspectiveUrl
          console.log('원근 변환 결과 사용, 데이터 URL 길이:', perspectiveUrl.length)
        }
      } catch (error) {
        console.warn('원근 변환 실패, 크롭 방식 사용:', error)
      }
    } else {
      throw new Error('Invalid crop area')
    }
  } catch (error) {
    console.error('보정 중 오류:', error)
    alert('이미지 보정 중 오류가 발생했습니다: ' + error.message)
    // 오류 발생 시 전체 이미지 표시
    ctx.drawImage(img, 0, 0, width, height)
    imageUrl.value = canvas.toDataURL('image/png')
  }
}

/**
 * Homography 행렬 계산
 */
const getPerspectiveMatrix = (src, dst) => {
  // 8개의 방정식으로 homography 행렬 계산
  const A = []
  const b = []
  
  for (let i = 0; i < 4; i++) {
    const x = src[i * 2]
    const y = src[i * 2 + 1]
    const u = dst[i * 2]
    const v = dst[i * 2 + 1]
    
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(u)
    b.push(v)
  }
  
  // 행렬 해결 (간단한 Gauss-Jordan 제거)
  const h = solveLinearSystem(A, b)
  
  return [
    h[0], h[1], h[2],
    h[3], h[4], h[5],
    h[6], h[7], 1
  ]
}

/**
 * 선형 방정식 시스템 해결
 */
const solveLinearSystem = (A, b) => {
  // 간단한 8x8 행렬 해결
  const n = A.length
  const augmented = A.map((row, i) => [...row, b[i]])
  
  // Forward elimination
  for (let i = 0; i < n; i++) {
    let maxRow = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]
    
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i]
      for (let j = i; j < n + 1; j++) {
        augmented[k][j] -= factor * augmented[i][j]
      }
    }
  }
  
  // Back substitution
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n]
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j]
    }
    x[i] /= augmented[i][i]
  }
  
  return x
}

/**
 * 원근 변환 픽셀 단위 적용
 */
const applyPerspective = (ctx, img, H, width, height, imgWidth, imgHeight) => {
  console.log('applyPerspective 시작:', { width, height, imgWidth, imgHeight, H })
  
  // 이미지가 완전히 로드되었는지 확인
  if (!img.complete) {
    console.warn('이미지가 아직 로드되지 않았습니다')
  }
  
  try {
    const resultData = ctx.createImageData(width, height)
    
    // 실제 이미지 데이터 가져오기
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = imgWidth
    tempCanvas.height = imgHeight
    const tempCtx = tempCanvas.getContext('2d')
    
    // 이미지 그리기
    tempCtx.drawImage(img, 0, 0, imgWidth, imgHeight)
    const imageData = tempCtx.getImageData(0, 0, imgWidth, imgHeight)
    
    console.log('이미지 데이터 로드 완료:', imageData.data.length, '픽셀', '크기:', imgWidth, 'x', imgHeight)
    
    let filledPixels = 0
    let skippedPixels = 0
    
    // 원근 변환 적용 - 순방향 변환 사용 (입력 -> 출력)
    // 입력 이미지의 각 픽셀을 출력 이미지로 변환
    for (let srcY = 0; srcY < imgHeight; srcY++) {
      for (let srcX = 0; srcX < imgWidth; srcX++) {
        // 순방향 변환: 입력 좌표 -> 출력 좌표
        const denom = H[6] * srcX + H[7] * srcY + H[8]
        if (Math.abs(denom) < 0.0001) {
          skippedPixels++
          continue
        }
        
        const dstX = (H[0] * srcX + H[1] * srcY + H[2]) / denom
        const dstY = (H[3] * srcX + H[4] * srcY + H[5]) / denom
        
        // 출력 좌표가 범위 내인지 확인
        if (dstX >= 0 && dstX < width && dstY >= 0 && dstY < height) {
          const x = Math.floor(dstX)
          const y = Math.floor(dstY)
          
          if (x >= 0 && x < width && y >= 0 && y < height) {
            // 픽셀 복사
            const srcIdx = (srcY * imgWidth + srcX) * 4
            const dstIdx = (y * width + x) * 4
            
            resultData.data[dstIdx] = imageData.data[srcIdx]
            resultData.data[dstIdx + 1] = imageData.data[srcIdx + 1]
            resultData.data[dstIdx + 2] = imageData.data[srcIdx + 2]
            resultData.data[dstIdx + 3] = imageData.data[srcIdx + 3]
            filledPixels++
          }
        }
      }
    }
    
    console.log('순방향 변환 완료, 채워진 픽셀:', filledPixels, '건너뛴 픽셀:', skippedPixels)
    
    // 역변환으로 빈 공간 채우기 (보완)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 이미 채워진 픽셀은 건너뛰기
        const idx = (y * width + x) * 4
        if (resultData.data[idx + 3] > 0) {
          continue
        }
        
        // 역변환: 출력 좌표 -> 입력 좌표
        const denom = H[6] * x + H[7] * y + H[8]
        if (Math.abs(denom) < 0.001) {
          continue
        }
        
        const srcX = (H[0] * x + H[1] * y + H[2]) / denom
        const srcY = (H[3] * x + H[4] * y + H[5]) / denom
        
        // 범위 체크를 완화하여 경계 픽셀도 처리
        if (srcX >= -1 && srcX < imgWidth + 1 && srcY >= -1 && srcY < imgHeight + 1) {
          // Bilinear interpolation
          const x1 = Math.floor(srcX)
          const y1 = Math.floor(srcY)
          const x2 = Math.min(x1 + 1, imgWidth - 1)
          const y2 = Math.min(y1 + 1, imgHeight - 1)
          
          const fx = srcX - x1
          const fy = srcY - y1
          
          const getPixel = (px, py) => {
            // 경계를 넘어가면 가장자리 픽셀 사용
            const safeX = Math.max(0, Math.min(px, imgWidth - 1))
            const safeY = Math.max(0, Math.min(py, imgHeight - 1))
            const idx = (safeY * imgWidth + safeX) * 4
            return [
              imageData.data[idx],
              imageData.data[idx + 1],
              imageData.data[idx + 2],
              imageData.data[idx + 3]
            ]
          }
          
          const p11 = getPixel(x1, y1)
          const p21 = getPixel(x2, y1)
          const p12 = getPixel(x1, y2)
          const p22 = getPixel(x2, y2)
          
          const p1 = [
            p11[0] * (1 - fx) + p21[0] * fx,
            p11[1] * (1 - fx) + p21[1] * fx,
            p11[2] * (1 - fx) + p21[2] * fx,
            p11[3] * (1 - fx) + p21[3] * fx
          ]
          
          const p2 = [
            p12[0] * (1 - fx) + p22[0] * fx,
            p12[1] * (1 - fx) + p22[1] * fx,
            p12[2] * (1 - fx) + p22[2] * fx,
            p12[3] * (1 - fx) + p22[3] * fx
          ]
          
          const result = [
            Math.round(p1[0] * (1 - fy) + p2[0] * fy),
            Math.round(p1[1] * (1 - fy) + p2[1] * fy),
            Math.round(p1[2] * (1 - fy) + p2[2] * fy),
            Math.round(p1[3] * (1 - fy) + p2[3] * fy)
          ]
          
          const idx = (y * width + x) * 4
          resultData.data[idx] = result[0]
          resultData.data[idx + 1] = result[1]
          resultData.data[idx + 2] = result[2]
          resultData.data[idx + 3] = result[3]
          filledPixels++
        } else {
          // 범위를 벗어난 픽셀은 검은색으로 처리
          const idx = (y * width + x) * 4
          resultData.data[idx] = 0
          resultData.data[idx + 1] = 0
          resultData.data[idx + 2] = 0
          resultData.data[idx + 3] = 255
        }
      }
    }
    
    console.log('채워진 픽셀 수:', filledPixels, '/', width * height)
    console.log('resultData 크기:', resultData.width, 'x', resultData.height)
    
    // 이미지 데이터 검증: 실제로 픽셀이 그려졌는지 확인
    let nonTransparentPixels = 0
    let nonBlackPixels = 0
    for (let i = 0; i < resultData.data.length; i += 4) {
      const alpha = resultData.data[i + 3]
      if (alpha > 0) {
        nonTransparentPixels++
        const r = resultData.data[i]
        const g = resultData.data[i + 1]
        const b = resultData.data[i + 2]
        if (r > 10 || g > 10 || b > 10) {
          nonBlackPixels++
        }
      }
    }
    console.log('비투명 픽셀:', nonTransparentPixels, '비검은색 픽셀:', nonBlackPixels)
    
    ctx.putImageData(resultData, 0, 0)
    console.log('이미지 데이터 적용 완료')
    
    // 캔버스 크기 확인
    console.log('캔버스 크기:', ctx.canvas.width, 'x', ctx.canvas.height)
    
    // 캔버스 내용 확인을 위한 테스트 그리기
    if (nonBlackPixels < 100) {
      console.warn('경고: 거의 모든 픽셀이 검은색이거나 투명합니다. 원근 변환이 제대로 작동하지 않았을 수 있습니다.')
    }
  } catch (error) {
    console.error('applyPerspective 오류:', error)
    throw error
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
}

/**
 * 다음 이미지로 이동
 */
const nextImage = () => {
  if (currentImageIndex.value < imageList.value.length - 1) {
    startProcessingImage(currentImageIndex.value + 1)
  }
}

/**
 * 이전 이미지로 이동
 */
const previousImage = () => {
  if (currentImageIndex.value > 0) {
    startProcessingImage(currentImageIndex.value - 1)
  }
}

/**
 * 현재 이미지 다시 처리
 */
const reprocessCurrentImage = () => {
  startProcessingImage(currentImageIndex.value)
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

// ==================== 라벨 관리 ====================
// labels.json 데이터 (메모리 및 localStorage에 저장)
const labelsData = ref({})

// File System Access API를 위한 파일 핸들 저장
const labelsFileHandle = ref(null)

// 보정 전 선분 정보 저장 (결과 화면에서 사용)
const savedLines = ref([])

// 보정 전 원본 이미지 정보 저장 (라벨 저장용)
const savedImageInfo = ref({
  naturalWidth: 0,
  naturalHeight: 0,
  displayWidth: 0,
  displayHeight: 0
})

// localStorage에서 기존 라벨 로드
const loadLabels = () => {
  try {
    const existingData = localStorage.getItem('labels')
    if (existingData) {
      labelsData.value = JSON.parse(existingData)
    } else {
      labelsData.value = {}
    }
  } catch (e) {
    console.warn('기존 라벨 데이터를 읽을 수 없습니다:', e)
    labelsData.value = {}
  }
}

// 파일에서 라벨 로드 (File System Access API)
const loadLabelsFromFile = async () => {
  if (!labelsFileHandle.value) return
  
  try {
    const file = await labelsFileHandle.value.getFile()
    const text = await file.text()
    const data = JSON.parse(text)
    labelsData.value = data
    localStorage.setItem('labels', JSON.stringify(data, null, 2))
  } catch (e) {
    console.warn('파일에서 라벨을 읽을 수 없습니다:', e)
  }
}

// 파일에 라벨 저장 (File System Access API)
const saveLabelsToFile = async () => {
  if (!labelsFileHandle.value) return
  
  try {
    const writable = await labelsFileHandle.value.createWritable()
    await writable.write(labelsJsonContent.value)
    await writable.close()
    console.log('labels.json 파일이 업데이트되었습니다.')
  } catch (e) {
    console.error('파일 저장 실패:', e)
    alert('파일 저장에 실패했습니다: ' + e.message)
  }
}

// labels.json 파일 선택 및 저장 위치 설정
const selectLabelsFile = async () => {
  try {
    // File System Access API 지원 확인
    if (!('showSaveFilePicker' in window)) {
      alert('이 브라우저는 파일 저장 기능을 지원하지 않습니다.\nChrome, Edge (최신 버전)를 사용해주세요.')
      return
    }
    
    // 기존 파일 핸들이 있으면 그대로 사용, 없으면 새로 선택
    if (!labelsFileHandle.value) {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'labels.json',
        types: [{
          description: 'JSON 파일',
          accept: { 'application/json': ['.json'] }
        }]
      })
      labelsFileHandle.value = handle
    }
    
    // 파일에 저장
    await saveLabelsToFile()
    alert('labels.json 파일이 저장되었습니다!')
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('파일 선택 실패:', e)
      alert('파일 선택에 실패했습니다: ' + e.message)
    }
  }
}

// 초기 로드
loadLabels()

// labels.json 내용을 JSON 문자열로 반환
const labelsJsonContent = computed(() => {
  return JSON.stringify(labelsData.value, null, 2)
})

/**
 * 라벨 저장 (교점 좌표를 labels.json에 추가)
 */
const saveLabel = () => {
  // 결과 화면에서는 savedLines 사용, 그리기 화면에서는 lines 사용
  const linesToUse = savedLines.value.length > 0 ? savedLines.value : lines.value
  
  if (linesToUse.length !== 4) {
    alert('4개의 선분이 필요합니다.')
    return
  }
  
  const horizontalLines = linesToUse.filter(l => l.type === 'horizontal')
  const verticalLines = linesToUse.filter(l => l.type === 'vertical')
  
  if (horizontalLines.length !== 2 || verticalLines.length !== 2) {
    alert('수평선 2개와 수직선 2개가 필요합니다.')
    return
  }
  
  // 저장된 이미지 정보 사용 (결과 화면에서는 imageDrawRef가 없을 수 있음)
  let imgNaturalWidth = savedImageInfo.value.naturalWidth
  let imgNaturalHeight = savedImageInfo.value.naturalHeight
  let imgDisplayWidth = savedImageInfo.value.displayWidth
  let imgDisplayHeight = savedImageInfo.value.displayHeight
  
  // 저장된 정보가 없으면 현재 이미지에서 가져오기 시도
  if (!imgNaturalWidth || !imgNaturalHeight || !imgDisplayWidth || !imgDisplayHeight) {
    const img = imageDrawRef.value?.imageRef?.value || imageDrawRef.value?.imageRef || imageRef.value
    if (img && img.naturalWidth && img.naturalHeight) {
      imgNaturalWidth = img.naturalWidth || img.width
      imgNaturalHeight = img.naturalHeight || img.height
      imgDisplayWidth = img.offsetWidth || img.width
      imgDisplayHeight = img.offsetHeight || img.height
    } else {
      // 이미지 파일에서 직접 크기 가져오기 (동기적으로 처리)
      const currentImageItem = imageList.value[currentImageIndex.value]
      if (currentImageItem?.file) {
        // 파일에서 이미지 크기 읽기 (FileReader 사용)
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new Image()
          img.onload = () => {
            imgNaturalWidth = img.naturalWidth
            imgNaturalHeight = img.naturalHeight
            imgDisplayWidth = img.width
            imgDisplayHeight = img.height
            // 저장된 정보 업데이트
            savedImageInfo.value = {
              naturalWidth: imgNaturalWidth,
              naturalHeight: imgNaturalHeight,
              displayWidth: imgDisplayWidth,
              displayHeight: imgDisplayHeight
            }
            // 라벨 저장 계속 진행
            continueSaveLabel(imgNaturalWidth, imgNaturalHeight, imgDisplayWidth, imgDisplayHeight, linesToUse, horizontalLines, verticalLines)
          }
          img.src = e.target.result
        }
        reader.readAsDataURL(currentImageItem.file)
        return // 비동기 처리 중이므로 여기서 종료
      } else {
        alert('이미지 정보를 찾을 수 없습니다.')
        return
      }
    }
  }
  
  // 동기적으로 처리 가능한 경우
  continueSaveLabel(imgNaturalWidth, imgNaturalHeight, imgDisplayWidth, imgDisplayHeight, linesToUse, horizontalLines, verticalLines)
}

/**
 * 라벨 저장 계속 진행 (이미지 크기 정보가 준비된 후)
 */
const continueSaveLabel = (imgNaturalWidth, imgNaturalHeight, imgDisplayWidth, imgDisplayHeight, linesToUse, horizontalLines, verticalLines) => {
  if (!imgNaturalWidth || !imgNaturalHeight || !imgDisplayWidth || !imgDisplayHeight) {
    alert('이미지 크기 정보를 찾을 수 없습니다.')
    return
  }
  
  const scaleX = imgNaturalWidth / imgDisplayWidth
  const scaleY = imgNaturalHeight / imgDisplayHeight
  
  // 교점 계산 (화면 좌표) - savedLines 또는 lines 사용
  const calculateIntersectionsFromLines = (linesArray) => {
    if (linesArray.length !== 4) return []
    
    const hLines = linesArray.filter(l => l.type === 'horizontal')
    const vLines = linesArray.filter(l => l.type === 'vertical')
    
    if (hLines.length !== 2 || vLines.length !== 2) return []
    
    const intersections = []
    for (const hLine of hLines) {
      for (const vLine of vLines) {
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
  
  const intersections = calculateIntersectionsFromLines(linesToUse)
  if (intersections.length !== 4) {
    alert('4개의 교점을 계산할 수 없습니다.')
    return
  }
  
  // 수직선과 수평선 정렬
  verticalLines.sort((a, b) => {
    const aX = (a.start.x + a.end.x) / 2
    const bX = (b.start.x + b.end.x) / 2
    return aX - bX // 왼쪽부터
  })
  
  horizontalLines.sort((a, b) => {
    const aY = (a.start.y + a.end.y) / 2
    const bY = (b.start.y + b.end.y) / 2
    return aY - bY // 위부터
  })
  
  const vLine1 = verticalLines[0]
  const vLine2 = verticalLines[1]
  const hLine1 = horizontalLines[0]
  const hLine2 = horizontalLines[1]
  
  // 실제 교점 계산 (화면 좌표)
  const p1 = getLineIntersection(vLine1, hLine1) // 좌상
  const p2 = getLineIntersection(vLine2, hLine1) // 우상
  const p3 = getLineIntersection(vLine1, hLine2) // 좌하
  const p4 = getLineIntersection(vLine2, hLine2) // 우하
  
  if (!p1 || !p2 || !p3 || !p4) {
    alert('교점을 계산할 수 없습니다.')
    return
  }
  
  // 이미지 좌표로 변환
  const vLine1_x = p1.x * scaleX
  const vLine2_x = p2.x * scaleX
  const hLine1_y = p1.y * scaleY
  const hLine2_y = p3.y * scaleY
  
  // 이미지 파일명 가져오기
  const currentImageItem = imageList.value[currentImageIndex.value]
  const imageName = currentImageItem?.name || `image_${String(currentImageIndex.value + 1).padStart(3, '0')}.png`
  
  // 라벨 데이터 생성
  const points = {
    p1_top_left: [vLine1_x, hLine1_y],
    p2_top_right: [vLine2_x, hLine1_y],
    p3_bottom_left: [vLine1_x, hLine2_y],
    p4_bottom_right: [vLine2_x, hLine2_y]
  }
  
  // 새 라벨 추가
  labelsData.value[imageName] = points
  
  // localStorage에 저장
  localStorage.setItem('labels', JSON.stringify(labelsData.value, null, 2))
  
  // 파일 핸들이 있으면 파일에도 자동 저장
  if (labelsFileHandle.value) {
    try {
      await saveLabelsToFile()
    } catch (e) {
      console.warn('파일 저장 실패:', e)
    }
  }
  
  alert(`라벨이 저장되었습니다!\n이미지: ${imageName}`)
}

/**
 * labels.json 다운로드 (또는 파일 저장 위치 설정)
 */
const downloadLabelsJson = async () => {
  // File System Access API를 지원하는 경우 파일 저장 위치 선택
  if ('showSaveFilePicker' in window && !labelsFileHandle.value) {
    const useFileSystem = confirm('파일 저장 위치를 설정하시겠습니까?\n\n"확인"을 누르면 프로그램 폴더에 labels.json 파일을 저장할 수 있습니다.\n"취소"를 누르면 일반 다운로드로 진행됩니다.')
    
    if (useFileSystem) {
      await selectLabelsFile()
      return
    }
  }
  
  // 기존 파일 핸들이 있으면 파일에 저장
  if (labelsFileHandle.value) {
    await saveLabelsToFile()
    alert('labels.json 파일이 업데이트되었습니다!')
    return
  }
  
  // 일반 다운로드
  const blob = new Blob([labelsJsonContent.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'labels.json'
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * 특정 이미지의 라벨 삭제
 */
const deleteLabel = (imageName) => {
  if (confirm(`"${imageName}"의 라벨을 삭제하시겠습니까?`)) {
    delete labelsData.value[imageName]
    localStorage.setItem('labels', JSON.stringify(labelsData.value, null, 2))
  }
}

/**
 * 모든 라벨 삭제
 */
const clearAllLabels = async () => {
  if (confirm('모든 라벨을 삭제하시겠습니까?')) {
    labelsData.value = {}
    localStorage.removeItem('labels')
    
    // 파일에도 저장
    if (labelsFileHandle.value) {
      try {
        await saveLabelsToFile()
      } catch (e) {
        console.warn('파일 저장 실패:', e)
      }
    }
  }
}

/**
 * 파일 저장 위치 정보 표시
 */
const showFileInfo = async () => {
  if (labelsFileHandle.value) {
    try {
      const file = await labelsFileHandle.value.getFile()
      alert(`현재 저장 위치:\n${file.name}\n\n파일 크기: ${(file.size / 1024).toFixed(2)} KB`)
    } catch (e) {
      alert('파일 정보를 가져올 수 없습니다.')
    }
  } else {
    alert('파일 저장 위치가 설정되지 않았습니다.\n"labels.json 다운로드" 버튼을 클릭하여 저장 위치를 설정하세요.')
  }
}

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
 * 모든 이미지 다운로드
 */
const downloadAllImages = () => {
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
    :current-image-info="currentImageInfo"
    :progress-percentage="progressPercentage"
    :image-list-length="imageList.length"
    :instruction="showInstruction"
    @line-added="handleLineAdded"
    @line-updated="handleLineUpdated"
    @line-duplicated="handleLineDuplicated"
    @line-deleted="handleLineDeleted"
    @correction="handleCorrection"
    @reset="resetProcess"
    @next="nextImage"
    @previous="previousImage"
  />

  <!-- 결과 확인 단계 -->
  <ImageResult
    v-if="currentStep === 'result'"
    :image-url="imageUrl"
    :current-image-info="currentImageInfo"
    :progress-percentage="progressPercentage"
    :image-list-length="imageList.length"
    :is-all-processed="isAllProcessed"
    :labels-data="labelsData"
    :labels-json-content="labelsJsonContent"
    @save="saveImage"
    @save-label="saveLabel"
    @download-labels="downloadLabelsJson"
    @delete-label="deleteLabel"
    @clear-labels="clearAllLabels"
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

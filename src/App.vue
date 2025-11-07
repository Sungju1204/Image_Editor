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

<script setup>
import { ref } from 'vue'
import ImageNavigation from './ImageNavigation.vue'

const props = defineProps({
  imageUrl: {
    type: String,
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
  isAllProcessed: {
    type: Boolean,
    default: false
  },
  labelsData: {
    type: Object,
    default: () => ({})
  },
  labelsJsonContent: {
    type: String,
    default: '{}'
  },
  labelsFileHandle: {
    type: Object,
    default: null
  }
})

const emit = defineEmits([
  'save',
  'save-label',
  'download-labels',
  'delete-label',
  'clear-labels',
  'show-file-info',
  'reprocess',
  'next',
  'previous',
  'reset',
  'download-all'
])

const showLabelsPanel = ref(false)

const copyLabelsJson = () => {
  navigator.clipboard.writeText(props.labelsJsonContent).then(() => {
    alert('JSON이 클립보드에 복사되었습니다!')
  }).catch(err => {
    console.error('복사 실패:', err)
    alert('복사에 실패했습니다.')
  })
}
</script>

<template>
  <div class="app-container">
    <div class="header">
      <span class="header-subtitle">이미지 보정 도구</span>
      <h1 class="header-title">이미지 보정 도구</h1>
      <p class="step-indicator">3단계: 보정된 이미지 확인 및 저장</p>
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
    </div>

    <div class="result-area">
      <img 
        :src="imageUrl" 
        alt="보정된 이미지" 
        class="result-image"
        @load="() => console.log('결과 이미지 로드 완료')"
        @error="(e) => console.error('결과 이미지 로드 실패:', e, 'imageUrl:', imageUrl)"
      />
      <div v-if="!imageUrl" style="color: red; padding: 2rem;">
        이미지가 로드되지 않았습니다. imageUrl: {{ imageUrl }}
      </div>
      
      <div class="button-group">
        <button class="save-btn" @click="emit('save')">보정된 이미지 다운로드</button>
        <button 
          class="label-btn" 
          @click="emit('save-label')"
        >
          라벨 저장
        </button>
        <button 
          class="restart-btn" 
          @click="emit('reprocess')"
        >
          기존 사진으로 다시 시작
        </button>
        <button 
          class="next-btn" 
          v-if="imageListLength > 1 && currentImageInfo.index < imageListLength"
          @click="emit('next')"
        >
          다음 이미지 처리
        </button>
        <button 
          class="prev-btn" 
          v-if="imageListLength > 1 && currentImageInfo.index > 1"
          @click="emit('previous')"
        >
          이전 이미지
        </button>
        <button class="reset-btn-white" @click="emit('reset')">새 이미지로 다시 시작</button>
      </div>
      
      <!-- 전체 완료 메시지 -->
      <div class="completion-message" v-if="isAllProcessed && imageListLength > 1">
        <p class="completion-text">🎉 모든 이미지 처리가 완료되었습니다!</p>
        <button class="download-all-btn" @click="emit('download-all')">모든 이미지 다운로드</button>
      </div>
      
      <!-- 라벨 관리 패널 -->
      <div class="labels-panel">
        <div class="labels-panel-header">
          <h3 class="labels-panel-title">labels.json 관리</h3>
          <button 
            class="labels-toggle-btn" 
            @click="showLabelsPanel = !showLabelsPanel"
          >
            {{ showLabelsPanel ? '숨기기' : '보기' }}
          </button>
        </div>
        
        <div v-if="showLabelsPanel" class="labels-panel-content">
          <div class="labels-actions">
            <button class="labels-download-btn" @click="emit('download-labels')">
              {{ labelsFileHandle ? 'labels.json 저장 위치 설정' : 'labels.json 다운로드' }}
            </button>
            <button 
              v-if="labelsFileHandle"
              class="labels-file-status-btn"
              @click="emit('show-file-info')"
              title="현재 저장 위치 확인"
            >
              📁 저장 위치 설정됨
            </button>
            <button 
              class="labels-clear-btn" 
              @click="emit('clear-labels')"
              :disabled="Object.keys(labelsData).length === 0"
            >
              모든 라벨 삭제
            </button>
          </div>
          
          <div class="labels-list" v-if="Object.keys(labelsData).length > 0">
            <div 
              v-for="(points, imageName) in labelsData" 
              :key="imageName"
              class="label-item"
            >
              <div class="label-item-header">
                <span class="label-image-name">{{ imageName }}</span>
                <button 
                  class="label-delete-btn" 
                  @click="emit('delete-label', imageName)"
                  title="라벨 삭제"
                >
                  ×
                </button>
              </div>
              <div class="label-points">
                <div v-for="(coord, pointName) in points" :key="pointName" class="label-point">
                  <span class="point-name">{{ pointName }}:</span>
                  <span class="point-coord">[{{ coord[0].toFixed(2) }}, {{ coord[1].toFixed(2) }}]</span>
                </div>
              </div>
            </div>
          </div>
          
          <div v-else class="labels-empty">
            저장된 라벨이 없습니다.
          </div>
          
          <div class="labels-json-viewer">
            <h4>labels.json 내용:</h4>
            <pre class="labels-json-content">{{ labelsJsonContent }}</pre>
            <button 
              class="labels-copy-btn" 
              @click="copyLabelsJson"
            >
              JSON 복사
            </button>
          </div>
        </div>
      </div>
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

.save-btn {
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

.save-btn:hover {
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

.label-btn {
  background-color: #8b5cf6;
  color: #ffffff;
  border: none;
  padding: 0.875rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.label-btn:hover {
  background-color: #7c3aed;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
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

.labels-panel {
  margin-top: 2rem;
  width: 100%;
  max-width: 800px;
  background-color: #1e1e1e;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #333;
}

.labels-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.labels-panel-title {
  color: #ffffff;
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.labels-toggle-btn {
  background-color: #646cff;
  color: #ffffff;
  border: none;
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.labels-toggle-btn:hover {
  background-color: #535bf2;
}

.labels-panel-content {
  margin-top: 1rem;
}

.labels-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.labels-download-btn,
.labels-clear-btn,
.labels-copy-btn {
  background-color: #22c55e;
  color: #ffffff;
  border: none;
  padding: 0.625rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.labels-download-btn:hover,
.labels-copy-btn:hover {
  background-color: #16a34a;
}

.labels-clear-btn {
  background-color: #ef4444;
}

.labels-clear-btn:hover:not(:disabled) {
  background-color: #dc2626;
}

.labels-clear-btn:disabled {
  background-color: #666;
  cursor: not-allowed;
}

.labels-list {
  margin-bottom: 1.5rem;
}

.label-item {
  background-color: #2a2a2a;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 1px solid #444;
}

.label-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.label-image-name {
  color: #ffffff;
  font-weight: 600;
  font-size: 1rem;
}

.label-delete-btn {
  background-color: #ef4444;
  color: #ffffff;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.label-delete-btn:hover {
  background-color: #dc2626;
  transform: scale(1.1);
}

.label-points {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.label-point {
  color: #cccccc;
  font-size: 0.9rem;
}

.point-name {
  color: #8b5cf6;
  font-weight: 600;
  margin-right: 0.5rem;
}

.point-coord {
  color: #ffffff;
  font-family: 'Courier New', monospace;
}

.labels-empty {
  text-align: center;
  color: #888;
  padding: 2rem;
  font-style: italic;
}

.labels-json-viewer {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #333;
}

.labels-json-viewer h4 {
  color: #ffffff;
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.labels-json-content {
  background-color: #1a1a1a;
  color: #00ff00;
  padding: 1rem;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #333;
  margin-bottom: 0.75rem;
}

.labels-file-status-btn {
  background-color: #22c55e;
  color: #ffffff;
  border: none;
  padding: 0.625rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.labels-file-status-btn:hover {
  background-color: #16a34a;
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
  
  .button-group {
    flex-direction: column;
    width: 100%;
  }

  .save-btn, .restart-btn, .reset-btn-white, .next-btn, .prev-btn {
    width: 100%;
  }
  
  .progress-info {
    max-width: 100%;
  }
}
</style>


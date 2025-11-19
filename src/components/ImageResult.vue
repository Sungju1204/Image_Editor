<script setup>
import { computed } from 'vue'
import ImageNavigation from './ImageNavigation.vue'

defineProps({
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
  }
})

const emit = defineEmits([
  'save',
  'reprocess',
  'next',
  'previous',
  'reset',
  'download-all'
])

// Electron API 확인 (computed로 처리하여 반응성 유지)
const isElectron = computed(() => {
  return typeof window !== 'undefined' && window.electronAPI
})
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
        @load="(e) => {
          console.log('결과 이미지 로드 완료', {
            naturalWidth: e.target.naturalWidth,
            naturalHeight: e.target.naturalHeight,
            width: e.target.width,
            height: e.target.height,
            imageUrlLength: imageUrl?.length
          })
        }"
        @error="(e) => {
          console.error('결과 이미지 로드 실패:', e, {
            imageUrl: imageUrl,
            imageUrlLength: imageUrl?.length,
            imageUrlPrefix: imageUrl?.substring(0, 50)
          })
        }"
      />
      <div v-if="!imageUrl" style="color: red; padding: 2rem;">
        이미지가 로드되지 않았습니다. imageUrl: {{ imageUrl }}
      </div>
      <div v-else-if="imageUrl && imageUrl.length < 1000" style="color: orange; padding: 1rem; background: #2a2a2a; border-radius: 8px; margin-top: 1rem;">
        ⚠️ 이미지 데이터가 너무 작습니다 ({{ imageUrl.length }} bytes). 이미지가 제대로 생성되지 않았을 수 있습니다.
      </div>
      
      <div class="button-group">
        <button class="save-btn" @click="emit('save')">보정된 이미지 다운로드</button>
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
          {{ isAllProcessed ? '다음 결과 보기' : '다음 이미지 처리' }}
        </button>
        <button 
          class="prev-btn" 
          v-if="imageListLength > 1 && currentImageInfo.index > 1"
          @click="emit('previous')"
        >
          {{ isAllProcessed ? '이전 결과 보기' : '이전 이미지' }}
        </button>
        <button class="reset-btn-white" @click="emit('reset')">새 이미지로 다시 시작</button>
      </div>
      
      <!-- 전체 완료 메시지 -->
      <div class="completion-message" v-if="isAllProcessed && imageListLength > 1">
        <p class="completion-text">🎉 모든 이미지 처리가 완료되었습니다!</p>
        <button class="download-all-btn" @click="emit('download-all')">
          {{ isElectron ? '모든 이미지 폴더에 저장' : '모든 이미지 다운로드' }}
        </button>
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


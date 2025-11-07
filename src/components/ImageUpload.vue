<script setup>
import { ref } from 'vue'

const emit = defineEmits(['files-selected'])

const isDragging = ref(false)
const fileInput = ref(null)

const handleFileSelect = (event) => {
  const files = Array.from(event.target.files)
  if (files.length > 0) {
    emit('files-selected', files)
  }
}

const handleDrop = (event) => {
  event.preventDefault()
  isDragging.value = false
  
  const files = Array.from(event.dataTransfer.files)
  if (files.length > 0) {
    emit('files-selected', files)
  }
}

const handleDragOver = (event) => {
  event.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const triggerFileInput = () => {
  fileInput.value?.click()
}
</script>

<template>
  <div class="app-container">
    <div class="header">
      <span class="header-subtitle">이미지 보정 도구</span>
      <h1 class="header-title">이미지 보정 도구</h1>
      <p class="step-indicator">1단계: 이미지를 업로드하세요</p>
    </div>

    <div 
      class="upload-area"
      :class="{ 'drag-over': isDragging }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="upload-icon">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      
      <p class="upload-text">파일을 여기에 끌어다 놓거나</p>
      <p class="upload-hint">여러 이미지를 선택할 수 있습니다</p>
      <button class="choose-file-btn" @click="triggerFileInput">파일 선택</button>
      
      <input 
        ref="fileInput"
        type="file" 
        accept="image/*" 
        multiple
        @change="handleFileSelect"
        style="display: none"
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

.choose-file-btn {
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

.choose-file-btn:hover {
  background-color: #535bf2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.3);
}

.choose-file-btn:active {
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
}
</style>


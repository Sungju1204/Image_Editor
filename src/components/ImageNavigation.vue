<script setup>
defineProps({
  currentIndex: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  canGoPrevious: {
    type: Boolean,
    default: false
  },
  canGoNext: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['previous', 'next'])
</script>

<template>
  <div class="image-navigation" v-if="total > 1">
    <button 
      class="nav-btn" 
      @click="emit('previous')" 
      :disabled="!canGoPrevious"
      title="이전 이미지"
    >
      ← 이전
    </button>
    <span class="nav-info">{{ currentIndex }} / {{ total }}</span>
    <button 
      class="nav-btn" 
      @click="emit('next')" 
      :disabled="!canGoNext"
      title="다음 이미지"
    >
      다음 →
    </button>
  </div>
</template>

<style scoped>
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

@media (max-width: 768px) {
  .image-navigation {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>


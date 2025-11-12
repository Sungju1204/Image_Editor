// Electron preload 스크립트
// 렌더러 프로세스와 메인 프로세스 간의 안전한 통신을 위한 브리지

const { contextBridge } = require('electron')

// 필요시 API를 노출할 수 있습니다
contextBridge.exposeInMainWorld('electronAPI', {
  // 예시: 플랫폼 정보
  platform: process.platform
})





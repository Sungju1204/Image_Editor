// Electron preload 스크립트
// 렌더러 프로세스와 메인 프로세스 간의 안전한 통신을 위한 브리지

const { contextBridge, ipcRenderer } = require('electron')

// API를 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 플랫폼 정보
  platform: process.platform,
  
  // 폴더 선택 다이얼로그
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  
  // 파일 저장 (base64 데이터를 파일로 저장)
  saveFile: (filePath, data) => ipcRenderer.invoke('save-file', filePath, data),
  
  // 여러 파일 저장 (폴더 경로와 파일 목록)
  saveFiles: (folderPath, files) => ipcRenderer.invoke('save-files', folderPath, files)
})





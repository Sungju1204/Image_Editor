import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'fs/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 개발 모드인지 확인
const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // 개발 모드에서는 Vite 개발 서버, 프로덕션에서는 빌드된 파일
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC 핸들러 등록
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('save-file', async (event, filePath, data) => {
  try {
    // base64 데이터를 버퍼로 변환
    const base64Data = data.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    
    // 파일 저장
    await fs.writeFile(filePath, buffer)
    return { success: true }
  } catch (error) {
    console.error('파일 저장 오류:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('save-files', async (event, folderPath, files) => {
  try {
    const results = []
    
    for (const file of files) {
      try {
        const filePath = path.join(folderPath, file.name)
        const base64Data = file.data.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        
        await fs.writeFile(filePath, buffer)
        results.push({ name: file.name, success: true })
      } catch (error) {
        console.error(`파일 ${file.name} 저장 오류:`, error)
        results.push({ name: file.name, success: false, error: error.message })
      }
    }
    
    return { success: true, results }
  } catch (error) {
    console.error('파일 저장 오류:', error)
    return { success: false, error: error.message }
  }
})





# GitHub 업로드 가이드

프로젝트를 GitHub에 업로드하기 위한 단계별 가이드입니다.

## 1. 프로젝트 디렉토리로 이동

PowerShell 또는 명령 프롬프트에서 다음 명령어를 실행하세요:

```powershell
cd "C:\Users\cse09\OneDrive - 한밭대학교\바탕 화면\3DP\이미지 전처리 툴\Image_Editor"
```

## 2. Git 저장소 초기화 (아직 안 했다면)

```bash
git init
```

## 3. 원격 저장소 연결

```bash
git remote add origin https://github.com/Sungju1204/Image_Editor.git
```

이미 연결되어 있다면:
```bash
git remote set-url origin https://github.com/Sungju1204/Image_Editor.git
```

## 4. 파일 추가 및 커밋

```bash
git add .
git commit -m "Initial commit: 이미지 보정 도구 프로젝트 - Vue.js 기반 원근 보정 애플리케이션"
```

## 5. 브랜치 이름 변경 및 푸시

```bash
git branch -M main
git push -u origin main
```

## 문제 해결

### 이미 원격 저장소에 파일이 있는 경우

원격 저장소에 이미 파일이 있다면 (예: README.md), 다음 명령어로 병합하세요:

```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

### 인증 문제

GitHub에 푸시할 때 인증이 필요합니다:
- Personal Access Token 사용
- 또는 GitHub Desktop 사용

## 완료 후 확인

https://github.com/Sungju1204/Image_Editor 에서 업로드된 파일을 확인할 수 있습니다.


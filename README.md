# OwL frontend

개인 음악 스트리밍 PWA "OwL"의 화면입니다. React 19, TypeScript, Vite, vite-plugin-pwa.

## 기능

- 홈 화면에 추가하면 앱처럼 실행됩니다(PWA).
- 백그라운드 재생, 잠금 화면과 제어 센터 조작(Media Session).
- 차트: 멜론, Apple Music 한국, Billboard Hot 100, YouTube 한국/미국 TOP 100. 보관함에 있는 곡은 바로 재생하고, 없는 곡은 바로 받습니다.
- 검색: 유튜브 뮤직에서 찾아 받기, 유튜브 링크 붙여 넣어 받기, 보관함 검색.
- 보관함: 재생목록, 앨범, 아티스트, 다운로드 현황.

## 개발

```
npm install
npm run dev      # /api 는 실제 서버로 프록시됩니다
npm run build
```

## 배포

`main`에 푸시하면 GitHub Actions가 빌드한 파일을 서버로 보냅니다. 서버는 새 폴더에 파일을 풀고 `current` 링크를 한 번에 바꿉니다(무중단).

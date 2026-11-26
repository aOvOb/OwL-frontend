# OwL frontend

개인 음악 스트리밍 PWA "OwL"의 화면입니다. React 19, TypeScript, Vite, vite-plugin-pwa.

## 기능

- 홈 화면에 추가하면 앱처럼 실행됩니다(PWA).
- 백그라운드 재생, 잠금 화면과 제어 센터 조작(Media Session).
- 차트: 멜론, Apple Music 한국, Billboard Hot 100, YouTube 한국/미국 TOP 100. 보관함에 있는 곡은 바로 재생하고, 없는 곡은 바로 받습니다.
- 검색: 유튜브 뮤직에서 찾아 받기, 유튜브 링크 붙여 넣어 받기, 보관함 검색.
- 보관함: 재생목록, 앨범, 아티스트, 다운로드 현황.

관리 화면(관리 전용 주소, 관리자 계정만)은 같은 레포에 있지만 따로 빌드하고 따로 배포합니다.
`admin/`(진입 HTML, 버전, 변경 기록)과 `src/admin/`(화면)에 있고, `src/`의 공통 코드를 함께 씁니다.

## 개발

```
npm install
npm run dev          # 음악 앱. /api 는 실제 서버로 프록시됩니다
npm run build        # 음악 앱 -> dist/
npm run dev:admin    # 관리 화면
npm run build:admin  # 관리 화면 -> dist-admin/
```

## 배포

`main`에 푸시하면 GitHub Actions가 빌드한 파일을 서버로 보냅니다. 서버는 새 폴더에 파일을 풀고 `current` 링크를 한 번에 바꿉니다(무중단).

- 음악 앱(`deploy.yml`): 관리 화면 파일(`admin/`, `src/admin/`)만 바뀐 푸시에서는 돌지 않습니다. 새 버전이 배포되면 사람들 기기의 앱이 새로 고침되므로, 관리 화면 작업이 음악 앱을 다시 배포하지 않게 했습니다.
- 관리 화면(`deploy-admin.yml`): `src/` 공통 코드가 바뀌어도 함께 배포됩니다. 태그는 `admin-vX.Y.Z`입니다.

# EmoRing

이모티콘 작가 써니의 홈페이지입니다. 작품 소개, 굿즈, 작가 인터뷰, 팬 커뮤니티, 관리자 대시보드로 구성되어 있습니다.

- 만든 방식: HTML · CSS · JavaScript. 별도 빌드 과정은 없습니다.
- 데이터: Firebase. 회원 로그인은 Authentication, 데이터 저장은 Cloud Firestore를 씁니다.
- Firebase 프로젝트: `emoring-dev` (개발용, 무료 Spark 요금제, Firestore 위치 `nam5`)

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `index.html` | 홈 |
| `page.html` | 소메뉴 7개, 작품·글 상세, 검색, 마이페이지 (`?p=` 값으로 화면 전환) |
| `login.html` · `signup.html` | 로그인 · 회원가입 |
| `admin.html` | 관리자 대시보드 |
| `css/` | `style.css` 사이트 공통 디자인, `admin.css` 관리자 화면 |
| `js/firebase-config.js` | Firebase 웹 앱 설정 |
| `js/store.js` | 로그인과 데이터 처리 (Firebase 연동) |
| `js/main.js` | 헤더·푸터·홈·하위 페이지 화면 |
| `js/auth.js` | 로그인·회원가입 입력 처리 |
| `js/admin.js` | 관리자 대시보드 화면과 기능 |
| `firestore.rules` | Firestore 보안 규칙 |
| `firebase.json` · `.firebaserc` | Firebase 배포 설정 |
| `scripts/set-admin.mjs` | 관리자 역할을 주거나 회수하는 스크립트 (서버 전용, 웹에 배포하지 않음) |

## 내 컴퓨터에서 실행하기

`index.html`을 더블클릭하면 바로 열립니다. 인터넷 연결만 있으면 로그인, 회원가입, 글쓰기, 관리자 화면까지 모두 동작합니다.
Firebase SDK를 일반 스크립트(compat) 방식으로 불러오기 때문에 `file://`로 열어도 됩니다.

로컬 서버로 열고 싶다면 아래처럼 실행합니다.

```bash
cd "C:\Users\e_iii\OneDrive\바탕 화면\EmoRing"
npx serve -l 5000 .
```

그다음 브라우저에서 http://localhost:5000 에 접속합니다.

## 관리자 지정

관리자 권한은 보안 때문에 화면에서 줄 수 없습니다. 아래 순서로 서버 스크립트를 실행하세요.

1. 사이트에서 써니 작가 계정으로 회원가입합니다.
2. 아래 명령을 실행합니다.

   ```bash
   cd scripts
   npm install
   # 서비스 계정 키(JSON)는 프로젝트 폴더 밖에 두고 경로만 지정합니다
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\keys\emoring-key.json"
   node set-admin.mjs 이메일 superAdmin --artist   # 최고 관리자 + '작가 써니' 배지
   node set-admin.mjs 이메일 operator              # 다른 역할: operator | finance | viewer
   node set-admin.mjs 이메일 --revoke              # 관리자 권한 회수
   ```

3. 사이트에서 로그아웃했다가 다시 로그인하면 관리자 페이지가 열립니다.

관리자 권한은 두 가지가 모두 맞을 때만 인정됩니다. 하나는 서버가 계정에 붙여 주는 역할 정보(Custom Claims의 `role`), 다른 하나는 Firestore의 `adminAccess/{uid}` 문서(`active: true`, 같은 `role`)입니다.

## 배포

```bash
firebase deploy --only firestore:rules --project emoring-dev   # 보안 규칙
firebase deploy --only hosting --project emoring-dev           # 사이트 → https://emoring-dev.web.app
```

## 아직 하지 않은 일

- 실제 작품 8종의 이름·이미지·판매처, 작가 인터뷰 답변을 입력해야 합니다.
- 사업자 정보, 이용약관, 개인정보처리방침이 비어 있습니다. 공개 전에 반드시 채워야 합니다.
- 결제 기능이 없습니다. 관리자 화면의 주문·매출은 `[데모]` 표시가 붙은 시안용 데이터이며, 개발 환경에서만 보입니다.
- 관리자 화면에서 역할을 바꾸는 기능과 감사 로그 자동 기록은 Cloud Functions가 필요하고, 그러려면 Blaze 요금제가 필요합니다.
- 실제 운영용 Firebase 프로젝트(`emoring-prod`)를 따로 만들어야 합니다. Firestore 위치는 서울(`asia-northeast3`)을 권장합니다.

## 보안 주의

- `js/firebase-config.js`의 `apiKey`는 공개해도 되는 식별자입니다. 접근 통제는 보안 규칙이 담당합니다.
- 서비스 계정 키 파일, 결제 비밀키는 이 폴더, Git, 채팅에 절대 넣지 마세요. `.gitignore`에 관련 패턴이 등록되어 있습니다.

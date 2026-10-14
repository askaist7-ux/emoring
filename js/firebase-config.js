// Firebase 웹 앱 설정 (Firebase 콘솔 → 프로젝트 설정 → 내 앱에서 확인)
// apiKey는 공개 식별자이며 비밀키가 아니다. 접근 통제는 Authentication + Security Rules로 한다.
window.EMORING_FIREBASE = {
  config: {
    apiKey: "AIzaSyBXE-rf8dR9ZMhMUhQ224KrspMG6bIbziY",
    authDomain: "emoring-dev.firebaseapp.com",
    projectId: "emoring-dev",
    storageBucket: "emoring-dev.firebasestorage.app",
    messagingSenderId: "857981514830",
    appId: "1:857981514830:web:14a62a5bc32f72f0fdff1f",
    measurementId: "G-ZCD4906B2B"
  },
  // 개발 환경 표시용. 운영 프로젝트로 바꾸면 'prod'로 변경한다.
  env: 'dev'
};

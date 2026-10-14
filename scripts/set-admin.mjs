// EmoRing 관리자 역할 부여·회수 (서버 전용, Firebase Admin SDK)
//
// 사용법 (scripts 폴더에서):
//   npm install
//   gcloud auth application-default login        ← 또는 GOOGLE_APPLICATION_CREDENTIALS=서비스계정키.json
//   node set-admin.mjs <이메일> superAdmin --artist   ← 써니 작가 계정: 최고 관리자 + '작가 써니' 배지
//   node set-admin.mjs <이메일> operator             ← 역할: superAdmin | operator | finance | viewer
//   node set-admin.mjs <이메일> --revoke             ← 관리자 권한 회수
//
// 서비스 계정 키 파일은 절대 Git·채팅·웹 폴더에 올리지 않는다.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'emoring-dev';
const ROLES = ['superAdmin', 'operator', 'finance', 'viewer'];

const [, , email, ...rest] = process.argv;
const revoke = rest.includes('--revoke');
const artist = rest.includes('--artist');
const role = rest.find(a => !a.startsWith('--'));

if (!email || (!revoke && !ROLES.includes(role))) {
  console.error('사용법: node set-admin.mjs <이메일> <superAdmin|operator|finance|viewer> [--artist]');
  console.error('        node set-admin.mjs <이메일> --revoke');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

const user = await auth.getUserByEmail(email).catch(() => null);
if (!user) {
  console.error(`[${PROJECT_ID}] ${email} 계정이 없습니다. 먼저 사이트에서 회원가입하세요.`);
  process.exit(1);
}

// setCustomUserClaims는 기존 claims를 통째로 바꾸므로, 기존 값을 읽어 필요한 키만 병합한다.
const claims = { ...(user.customClaims || {}) };
if (revoke) {
  // 회수 순서: 접근 문서 비활성화 → claims 정리 → 세션 토큰 폐기
  await db.doc(`adminAccess/${user.uid}`).set({ active: false, role: claims.role || null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  delete claims.role;
  await auth.setCustomUserClaims(user.uid, claims);
  await auth.revokeRefreshTokens(user.uid);
  await db.doc(`users/${user.uid}`).set({ role: 'member' }, { merge: true });
  console.log(`[${PROJECT_ID}] ${email}: 관리자 권한을 회수했습니다.`);
} else {
  claims.role = role;
  if (artist) claims.artist = true;
  await auth.setCustomUserClaims(user.uid, claims);
  await db.doc(`adminAccess/${user.uid}`).set({ active: true, role, updatedAt: FieldValue.serverTimestamp() });
  await db.doc(`users/${user.uid}`).set({ role }, { merge: true }); // 관리자 화면 표시용
  console.log(`[${PROJECT_ID}] ${email}: ${role}${artist ? ' + 작가 배지' : ''} 부여 완료. 사이트에서 로그아웃 후 다시 로그인하세요.`);
}
process.exit(0);

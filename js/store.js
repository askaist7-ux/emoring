/* EmoRing 데이터·인증 계층 — Firebase Authentication + Cloud Firestore
 * 화면 코드는 동기 목록 함수(listWorks 등)를 쓰므로, 시작 시 필요한 컬렉션을 읽어 메모리에 캐시한다.
 * 변경 함수는 모두 async이며 최종 권한 판단은 firestore.rules가 한다. (Firebase_MCP.md 5·8장) */
(function () {
// 파일을 더블클릭해 연 화면(file://)에서도 동작하도록 Firebase compat SDK(일반 스크립트)를 쓴다.
// 아래는 모듈 SDK와 같은 이름의 얇은 변환 함수라서 나머지 코드는 그대로 둔다.
const fb = window.firebase;
const { config: firebaseConfig, env: ENV } = window.EMORING_FIREBASE;
const app = fb.apps.length ? fb.app() : fb.initializeApp(firebaseConfig);
const auth = fb.auth(app);
const db = fb.firestore(app);

const onAuthStateChanged = (a, cb) => a.onAuthStateChanged(cb);
const createUserWithEmailAndPassword = (a, e, pw) => a.createUserWithEmailAndPassword(e, pw);
const signInWithEmailAndPassword = (a, e, pw) => a.signInWithEmailAndPassword(e, pw);
const signOut = (a) => a.signOut();
// file://에서는 브라우저가 일부 저장 방식을 막을 수 있어, 실패하면 기본 저장 방식으로 계속한다.
const setPersistence = (a, mode) => a.setPersistence(mode).catch(e => console.info('[EmoRing] 로그인 유지 방식 변경 불가', e.code || e.message));
const browserLocalPersistence = fb.auth.Auth.Persistence.LOCAL;
const browserSessionPersistence = fb.auth.Auth.Persistence.SESSION;

const collection = (d, ...path) => d.collection(path.join('/'));
const doc = (d, ...path) => d.doc(path.join('/'));
const getDoc = async (ref) => { const s = await ref.get(); return { id: s.id, exists: () => s.exists, data: () => s.data() }; };
const getDocs = (q) => q.get();
const setDoc = (ref, data, opt) => (opt ? ref.set(data, opt) : ref.set(data));
const addDoc = (col, data) => col.add(data);
const updateDoc = (ref, data) => ref.update(data);
const deleteDoc = (ref) => ref.delete();
const where = (field, op, value) => (q) => q.where(field, op, value);
const query = (base, ...constraints) => constraints.reduce((q, c) => c(q), base);
const serverTimestamp = () => fb.firestore.FieldValue.serverTimestamp();
const arrayUnion = (...v) => fb.firestore.FieldValue.arrayUnion(...v);

/* ---------- 상수 ---------- */
const ROLES = { member: '일반 회원', superAdmin: '최고 관리자', operator: '운영자', finance: '재무', viewer: '조회 전용' };
const PERMS = {
  'admin.access': ['superAdmin', 'operator', 'finance', 'viewer'],
  'members.view': ['superAdmin', 'operator'],
  'members.status': ['superAdmin', 'operator'],
  'members.role': ['superAdmin'],
  'content.view': ['superAdmin', 'operator', 'viewer'],
  'content.edit': ['superAdmin', 'operator'],
  'community.edit': ['superAdmin', 'operator'],
  'orders.view': ['superAdmin', 'finance'],
  'audit.view': ['superAdmin'],
  'settings.edit': ['superAdmin']
};
const WORK_TINTS = ['#FFE3D3', '#FFF0C2', '#DDF0FF', '#FFDDE2', '#E3F4E6', '#EDE4FF', '#FFE9C9', '#DCEBFF'];
const WORK_STATUS = { empty: '자료 입력 대기', review: '검토 중', approved: '승인 · 출시 대기', onsale: '판매 중', hidden: '게시 중지' };
const POST_TAGS = ['자유 이야기', '팬아트', '굿즈 후기', '작가에게 질문'];
const NEWS_TYPES = { notice: '공지사항', release: '신작 소식', goods: '굿즈 출시', event: '이벤트' };
const GOODS_TYPES = ['문구', '소품', '리빙', '패션', '디지털'];
const ARTICLE_TYPES = ['인터뷰', '작업실 이야기', '제작 과정'];

const can = (user, perm) => !!user && user.status === 'active' && (PERMS[perm] || []).includes(user.role);
const nowIso = () => new Date().toISOString();
const iso = (v) => (v && typeof v.toDate === 'function') ? v.toDate().toISOString() : (typeof v === 'string' ? v : nowIso());
const need = (cond, msg) => { if (!cond) throw new Error(msg); };
// Firestore가 아직 생성되지 않았거나 네트워크가 끊기면 SDK가 조용히 재시도하므로 시간 제한을 둔다.
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(msg), { code: 'timeout' })), ms))]);
const DB_TIMEOUT_MSG = 'Firestore에 연결할 수 없습니다. Firebase 콘솔에서 Firestore 데이터베이스가 생성되었는지 확인해 주세요.';

/* ---------- 캐시 ---------- */
const cache = { user: null, works: [], news: [], posts: [], products: [], articles: [], users: [], audit: [], orders: [], health: null, adminLoaded: false };
let loadError = null;

/* ---------- 인증 ---------- */
const AUTH_MSG = {
  'auth/invalid-credential': '이메일 또는 비밀번호가 일치하지 않습니다.',
  'auth/wrong-password': '이메일 또는 비밀번호가 일치하지 않습니다.',
  'auth/user-not-found': '이메일 또는 비밀번호가 일치하지 않습니다.',
  'auth/invalid-email': '이메일 형식을 확인해 주세요.',
  'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인해 주세요.',
  'auth/weak-password': '비밀번호 조건을 확인해 주세요.',
  'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  'auth/user-disabled': '이용이 제한된 계정입니다. 고객 문의로 연락해 주세요.',
  'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
  'auth/operation-not-allowed': 'Firebase 콘솔에서 이메일/비밀번호 로그인이 사용 설정되지 않았습니다.',
  'auth/configuration-not-found': 'Firebase 콘솔에서 Authentication을 아직 시작하지 않았습니다. (Authentication → 시작하기)',
  'auth/unauthorized-domain': '이 주소는 Firebase 승인된 도메인에 없습니다. localhost 또는 배포 주소로 열어 주세요.',
  'permission-denied': '권한이 없습니다.',
  'unavailable': '서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.'
};
const friendly = (e) => new Error(AUTH_MSG[e && e.code] || (e && e.message) || '알 수 없는 오류가 발생했습니다.');

// 역할은 서버가 부여한 Custom Claims + adminAccess 문서가 모두 일치할 때만 인정한다(Rules와 동일한 판단).
async function loadProfile(fbUser) {
  if (!fbUser) { cache.user = null; return null; }
  const [snap, token] = await withTimeout(Promise.all([getDoc(doc(db, 'users', fbUser.uid)), fbUser.getIdTokenResult(true)]), 10000, DB_TIMEOUT_MSG);
  const data = snap.exists() ? snap.data() : {};
  let role = 'member';
  const claimRole = token.claims.role;
  if (claimRole && ROLES[claimRole]) {
    try {
      const acc = await getDoc(doc(db, 'adminAccess', fbUser.uid));
      if (acc.exists() && acc.data().active === true && acc.data().role === claimRole) role = claimRole;
    } catch (e) { /* 읽기 실패 시 일반 회원으로 취급 */ }
  }
  cache.user = {
    uid: fbUser.uid, email: fbUser.email || '', name: data.name || '',
    nickname: data.nickname || (fbUser.email || '회원').split('@')[0],
    role, status: data.status || 'active', createdAt: iso(data.createdAt || fbUser.metadata.creationTime && new Date(fbUser.metadata.creationTime).toISOString()),
    isArtist: token.claims.artist === true, marketing: !!data.marketing
  };
  if (cache.user.status !== 'active') { await signOut(auth); cache.user = null; }
  return cache.user;
}

function pwProblems(pw) {
  const p = [];
  if (pw.length < 8) p.push('8자 이상');
  if (!/[A-Za-z]/.test(pw)) p.push('영문 포함');
  if (!/\d/.test(pw)) p.push('숫자 포함');
  return p;
}

async function signup({ email, password, name, nickname, marketing }) {
  email = (email || '').trim().toLowerCase();
  need(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email), '이메일 형식을 확인해 주세요.');
  need(!pwProblems(password).length, '비밀번호 조건을 확인해 주세요.');
  need(name && name.trim(), '이름을 입력해 주세요.');
  need(nickname && nickname.trim().length >= 2 && nickname.trim().length <= 16, '닉네임은 2~16자로 입력해 주세요.');
  try {
    await setPersistence(auth, browserSessionPersistence);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      email, name: name.trim(), nickname: nickname.trim(), marketing: !!marketing, status: 'active', createdAt: serverTimestamp()
    });
    return await loadProfile(cred.user);
  } catch (e) { throw friendly(e); }
}

async function login(email, password, remember) {
  try {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, (email || '').trim().toLowerCase(), password);
    const u = await loadProfile(cred.user);
    if (!u) throw new Error('이용이 제한된 계정입니다. 고객 문의로 연락해 주세요.');
    return u;
  } catch (e) { throw e.code ? friendly(e) : e; }
}
async function logout() { await signOut(auth); cache.user = null; }
const currentUser = () => cache.user;

/* ---------- 공개 데이터 로드 ---------- */
const mapDocs = (snap, fn) => snap.docs.map(d => fn(d.id, d.data()));
const toWork = (id, d) => ({
  id, no: d.no, name: d.name || '', concept: d.concept || '', platform: d.platform || '', saleUrl: d.saleUrl || '',
  status: d.status || 'empty', story: d.story || '', tint: d.tint || WORK_TINTS[(d.no || 1) - 1], updatedAt: iso(d.updatedAt)
});
const toNews = (id, d) => ({
  id, type: d.type, title: d.title, body: d.body, important: !!d.important, status: d.status, createdAt: iso(d.createdAt),
  // 이벤트 전용(선택): 기간·대상·참여 방법·결과 발표, 변경 안내
  startAt: d.startAt ? iso(d.startAt) : '', endAt: d.endAt ? iso(d.endAt) : '', target: d.target || '', how: d.how || '',
  resultInfo: d.resultInfo || '', joinUrl: d.joinUrl || '', changeNote: d.changeNote || '', workIds: d.workIds || [], productIds: d.productIds || []
});
const toProduct = (id, d) => ({
  id, name: d.name || '', type: d.type || '', workIds: d.workIds || [], status: d.status || 'hidden',
  price: Number.isFinite(d.price) ? d.price : null, listPrice: Number.isFinite(d.listPrice) ? d.listPrice : null,
  options: (d.options || []).map(o => ({ label: o.label || '', soldOut: !!o.soldOut })), images: d.images || [],
  summary: d.summary || '', description: d.description || '', material: d.material || '', size: d.size || '', components: d.components || '',
  caution: d.caution || '', shipping: d.shipping || '', madeToOrder: d.madeToOrder || '', digital: !!d.digital, featured: !!d.featured,
  createdAt: iso(d.createdAt)
});
const toArticle = (id, d) => ({
  id, type: d.type || '인터뷰', title: d.title || '', summary: d.summary || '', intro: d.intro || '', qa: d.qa || [], body: d.body || '',
  author: d.author || 'EmoRing', featured: !!d.featured, workIds: d.workIds || [], productIds: d.productIds || [], status: d.status, createdAt: iso(d.publishedAt || d.createdAt)
});
const toPost = (id, d) => ({
  id, authorUid: d.authorUid, author: d.author, isArtist: !!d.isArtist, tag: d.tag, workId: d.workId || '',
  title: d.title, body: d.body, status: d.status, createdAt: iso(d.createdAt),
  reportedBy: d.reportedBy || [], reports: (d.reportedBy || []).length, moderationReason: d.moderationReason || ''
});
const byNewest = (a, b) => b.createdAt.localeCompare(a.createdAt);

async function loadPublic() {
  const staff = can(cache.user, 'content.view');
  const [w, n, p] = await withTimeout(Promise.all([
    getDocs(collection(db, 'works')),
    getDocs(staff ? collection(db, 'news') : query(collection(db, 'news'), where('status', '==', 'published'))),
    getDocs(query(collection(db, 'posts'), where('status', '==', 'published')))
  ]), 10000, DB_TIMEOUT_MSG);
  cache.works = mapDocs(w, toWork);
  cache.news = mapDocs(n, toNews).sort(byNewest);
  cache.posts = mapDocs(p, toPost).sort(byNewest);
  // 작품 8종 문서가 없으면 편집 권한이 있는 관리자가 처음 접속할 때 자리 문서를 만든다.
  if (cache.works.length < 8 && can(cache.user, 'content.edit')) {
    for (let i = 1; i <= 8; i++) {
      const id = 'w0' + i;
      if (cache.works.some(x => x.id === id)) continue;
      const data = { no: i, name: '', concept: '', platform: '', saleUrl: '', status: 'empty', story: '', tint: WORK_TINTS[i - 1], updatedAt: serverTimestamp() };
      await setDoc(doc(db, 'works', id), data);
      cache.works.push(toWork(id, { ...data, updatedAt: nowIso() }));
    }
  }
  fillWorkSlots();
  await loadOptional();
}
// 굿즈·매거진은 운영 전이라 컬렉션·Rules가 없을 수 있다. 실패해도 나머지 화면은 그대로 쓴다.
async function loadOptional() {
  const opt = (name, statuses, map) => withTimeout(getDocs(query(collection(db, name), where('status', 'in', statuses))), 6000, '')
    .then(s => mapDocs(s, map)).catch(e => { console.info(`[EmoRing] ${name} 미연결`, e.code || e.message); return []; });
  const [pr, ar] = await Promise.all([opt('products', ['onsale', 'soldout'], toProduct), opt('articles', ['published'], toArticle)]);
  cache.products = pr.sort(byNewest);
  cache.articles = ar.sort(byNewest);
}
// 아직 Firestore에 없는 작품 번호는 화면용 자리표시(저장하지 않음)로 채운다.
function fillWorkSlots() {
  for (let i = 1; i <= 8; i++) {
    if (!cache.works.some(w => w.no === i)) cache.works.push(toWork('w0' + i, { no: i, status: 'empty', tint: WORK_TINTS[i - 1], updatedAt: nowIso() }));
  }
  cache.works.sort((a, b) => a.no - b.no);
}

// 첫 인증 상태 확인 → 공개 데이터 로드가 끝나면 resolve
const ready = new Promise(resolve => {
  let first = true;
  onAuthStateChanged(auth, async (fbUser) => {
    try { await loadProfile(fbUser); } catch (e) { console.warn('[EmoRing] 프로필 로드 실패', e); cache.user = null; }
    if (!first) return;
    first = false;
    try { await loadPublic(); } catch (e) { loadError = friendly(e); fillWorkSlots(); console.error('[EmoRing] 데이터 로드 실패', e); }
    resolve();
  });
});

/* ---------- 관리자 데이터 로드 ---------- */
async function loadAdmin() {
  const me = cache.user;
  need(can(me, 'admin.access'), '권한이 없습니다.');
  const t0 = performance.now();
  await loadPublic();
  const latency = +(performance.now() - t0).toFixed(0);
  const jobs = [];
  if (can(me, 'community.edit')) jobs.push(getDocs(collection(db, 'posts')).then(s => { cache.posts = mapDocs(s, toPost).sort(byNewest); }));
  if (can(me, 'members.view')) jobs.push(getDocs(collection(db, 'users')).then(s => {
    cache.users = mapDocs(s, (id, d) => ({ uid: id, email: d.email || '', name: d.name || '', nickname: d.nickname || '', role: d.role || 'member', status: d.status || 'active', createdAt: iso(d.createdAt) }));
  }));
  if (can(me, 'audit.view')) jobs.push(getDocs(collection(db, 'auditLogs')).then(s => {
    cache.audit = mapDocs(s, (id, d) => ({ id, actor: d.actor, action: d.action, target: d.target, outcome: d.outcome || '성공', at: iso(d.at) })).sort((a, b) => b.at.localeCompare(a.at));
  }));
  if (can(me, 'orders.view')) jobs.push(getDocs(collection(db, 'orders')).then(s => {
    cache.orders = mapDocs(s, (id, d) => ({ id, demo: false, buyer: d.buyerName || d.userId || '-', product: d.productName || '-', qty: d.qty || 1, currency: d.currency || 'KRW', amountMinor: d.amountMinor || 0, refundMinor: d.refundMinor || 0, status: d.status, paidAt: iso(d.paidAt) }));
  }));
  await withTimeout(Promise.all(jobs), 15000, DB_TIMEOUT_MSG);
  cache.health = { ok: true, latencyMs: latency, checkedAt: nowIso() };
  cache.adminLoaded = true;
}

async function audit(action, target, outcome = '성공') {
  const me = cache.user;
  if (!can(me, 'admin.access')) return;
  try {
    await addDoc(collection(db, 'auditLogs'), { actorUid: me.uid, actor: me.email, action, target, outcome, at: serverTimestamp() });
  } catch (e) { console.warn('[EmoRing] 감사 기록 실패', e); }
}

/* ---------- 회원 관리 ---------- */
const listUsers = () => cache.users.slice();
async function setUserStatus(actor, uid, status, reason) {
  need(can(actor, 'members.status'), '권한이 없습니다.');
  need(['active', 'disabled'].includes(status), '허용되지 않은 상태입니다.');
  need(actor.uid !== uid, '본인 계정은 변경할 수 없습니다.');
  need(reason && reason.trim(), '사유를 입력해 주세요.');
  const u = cache.users.find(x => x.uid === uid);
  need(u, '회원을 찾을 수 없습니다.');
  need(u.role === 'member' || actor.role === 'superAdmin', '관리자 계정은 최고 관리자만 변경할 수 있습니다.');
  try {
    await updateDoc(doc(db, 'users', uid), { status, statusReason: reason.trim(), statusUpdatedBy: actor.uid, statusUpdatedAt: serverTimestamp() });
  } catch (e) { throw friendly(e); }
  u.status = status;
  await audit(status === 'active' ? '계정 활성화' : '계정 비활성화', `${u.email} · 사유: ${reason.trim()}`);
}
async function setUserRole() {
  throw new Error('역할 부여·회수는 서버에서만 할 수 있습니다. scripts/set-admin.mjs를 사용하세요.');
}

/* ---------- 작품 ---------- */
const listWorks = () => cache.works.slice();
const getWork = (id) => cache.works.find(w => w.id === id) || null;
async function updateWork(actor, id, patch) {
  need(can(actor, 'content.edit'), '권한이 없습니다.');
  need(!patch.status || WORK_STATUS[patch.status], '허용되지 않은 상태입니다.');
  const w = getWork(id);
  need(w, '작품을 찾을 수 없습니다.');
  const next = { ...w, ...patch };
  need(!['approved', 'onsale'].includes(next.status) || next.name.trim(), '작품명을 입력해야 승인·판매 상태로 바꿀 수 있습니다.');
  need(next.status !== 'onsale' || /^https?:\/\//.test(next.saleUrl || ''), '판매 중 상태에는 공식 판매처 링크(https://…)가 필요합니다.');
  try { await updateDoc(doc(db, 'works', id), { ...patch, updatedAt: serverTimestamp() }); } catch (e) { throw friendly(e); }
  Object.assign(w, patch, { updatedAt: nowIso() });
  await audit('작품 수정', `작품 ${String(w.no).padStart(2, '0')} · ${WORK_STATUS[w.status]}`);
}

/* ---------- 커뮤니티 ---------- */
const listPosts = ({ includeHidden = false } = {}) => cache.posts.filter(p => includeHidden || p.status === 'published');
async function addPost(user, { tag, workId, title, body }) {
  need(user, '로그인 후 글을 쓸 수 있습니다.');
  need(POST_TAGS.includes(tag), '태그를 선택해 주세요.');
  need(title && title.trim() && title.length <= 60, '제목은 1~60자로 입력해 주세요.');
  need(body && body.trim() && body.length <= 2000, '내용은 1~2000자로 입력해 주세요.');
  const data = {
    authorUid: user.uid, author: user.nickname, isArtist: !!user.isArtist, tag, workId: workId || '',
    title: title.trim(), body: body.trim(), status: 'published', reportedBy: [], createdAt: serverTimestamp()
  };
  let ref;
  try { ref = await addDoc(collection(db, 'posts'), data); } catch (e) { throw friendly(e); }
  const post = toPost(ref.id, { ...data, createdAt: nowIso() });
  cache.posts.unshift(post);
  return post;
}
async function deleteOwnPost(user, id) {
  const p = cache.posts.find(x => x.id === id);
  need(p && user && p.authorUid === user.uid, '본인 글만 삭제할 수 있습니다.');
  try { await deleteDoc(doc(db, 'posts', id)); } catch (e) { throw friendly(e); }
  cache.posts = cache.posts.filter(x => x.id !== id);
}
async function reportPost(user, id) {
  need(user, '로그인 후 신고할 수 있습니다.');
  const p = cache.posts.find(x => x.id === id);
  need(p, '게시글을 찾을 수 없습니다.');
  need(!p.reportedBy.includes(user.uid), '이미 신고한 글입니다.');
  try { await updateDoc(doc(db, 'posts', id), { reportedBy: arrayUnion(user.uid) }); } catch (e) { throw friendly(e); }
  p.reportedBy.push(user.uid); p.reports = p.reportedBy.length;
}
async function setPostStatus(actor, id, status, reason) {
  need(can(actor, 'community.edit'), '권한이 없습니다.');
  need(['published', 'hidden'].includes(status), '허용되지 않은 상태입니다.');
  const p = cache.posts.find(x => x.id === id);
  need(p, '게시글을 찾을 수 없습니다.');
  const patch = { status, moderationReason: reason || '', moderatedBy: actor.uid, moderatedAt: serverTimestamp() };
  if (status === 'published') patch.reportedBy = [];
  try { await updateDoc(doc(db, 'posts', id), patch); } catch (e) { throw friendly(e); }
  Object.assign(p, { status, moderationReason: reason || '' });
  if (status === 'published') { p.reportedBy = []; p.reports = 0; }
  await audit(status === 'hidden' ? '게시글 숨김' : '게시글 복원', `${p.title}${reason ? ' · 사유: ' + reason : ''}`);
}

/* ---------- 댓글 (posts/{id}/comments) ---------- */
async function listComments(postId) {
  try {
    const s = await withTimeout(getDocs(query(collection(db, 'posts', postId, 'comments'), where('status', '==', 'published'))), 8000, DB_TIMEOUT_MSG);
    return mapDocs(s, (id, d) => ({ id, authorUid: d.authorUid, author: d.author, isArtist: !!d.isArtist, body: d.body, createdAt: iso(d.createdAt) }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch (e) { throw friendly(e); }
}
async function addComment(user, postId, body) {
  need(user, '로그인 후 댓글을 쓸 수 있습니다.');
  need(body && body.trim() && body.length <= 500, '댓글은 1~500자로 입력해 주세요.');
  const data = { authorUid: user.uid, author: user.nickname, isArtist: !!user.isArtist, body: body.trim(), status: 'published', createdAt: serverTimestamp() };
  let ref;
  try { ref = await addDoc(collection(db, 'posts', postId, 'comments'), data); } catch (e) { throw friendly(e); }
  return { id: ref.id, ...data, createdAt: nowIso() };
}
async function deleteOwnComment(user, postId, c) {
  need(user && c.authorUid === user.uid, '본인 댓글만 삭제할 수 있습니다.');
  try { await deleteDoc(doc(db, 'posts', postId, 'comments', c.id)); } catch (e) { throw friendly(e); }
}

/* ---------- 굿즈·매거진 (읽기 전용) ---------- */
const listProducts = () => cache.products.slice();
const getProduct = (id) => cache.products.find(p => p.id === id) || null;
const listArticles = () => cache.articles.slice();
const getArticle = (id) => cache.articles.find(a => a.id === id) || null;

/* ---------- 소식 ---------- */
const listNews = ({ includeHidden = false } = {}) => cache.news.filter(n => includeHidden || n.status === 'published');
async function addNews(actor, { type, title, body, important }) {
  need(can(actor, 'content.edit'), '권한이 없습니다.');
  need(NEWS_TYPES[type], '분류를 선택해 주세요.');
  need(title && title.trim(), '제목을 입력해 주세요.');
  need(body && body.trim(), '내용을 입력해 주세요.');
  const data = { type, title: title.trim(), body: body.trim(), important: !!important, status: 'published', createdAt: serverTimestamp() };
  let ref;
  try { ref = await addDoc(collection(db, 'news'), data); } catch (e) { throw friendly(e); }
  cache.news.unshift(toNews(ref.id, { ...data, createdAt: nowIso() }));
  await audit('소식 등록', data.title);
}
async function setNewsStatus(actor, id, status) {
  need(can(actor, 'content.edit'), '권한이 없습니다.');
  const n = cache.news.find(x => x.id === id);
  need(n, '소식을 찾을 수 없습니다.');
  try { await updateDoc(doc(db, 'news', id), { status }); } catch (e) { throw friendly(e); }
  n.status = status;
  await audit(status === 'hidden' ? '소식 비공개' : '소식 공개', n.title);
}

/* ---------- 주문 (결제 연동 전: 개발 환경에서만 데모 주문을 화면에 합쳐 보여줌) ---------- */
const DEMO_KEY = 'er.demoOrders';
const demoEnabled = () => { if (ENV !== 'dev') return false; try { return localStorage.getItem(DEMO_KEY) !== 'off'; } catch (e) { return true; } };
function setDemoOrders(actor, on) {
  need(can(actor, 'settings.edit'), '권한이 없습니다.');
  try { localStorage.setItem(DEMO_KEY, on ? 'on' : 'off'); } catch (e) { }
}
function makeDemoOrders() {
  const items = ['[데모] 아크릴 키링', '[데모] 스티커 세트', '[데모] 엽서 3종', '[데모] 머그컵', '[데모] 디지털 배경화면'];
  const prices = [8000, 4500, 3000, 15000, 2000];
  const out = []; let seq = 1;
  const today = new Date(); today.setHours(12, 0, 0, 0);
  for (let d = 179; d >= 0; d--) {
    const n = (d * 7 + 3) % 4;
    for (let j = 0; j < n; j++) {
      const k = (d + j * 2) % items.length, qty = 1 + ((d + j) % 3);
      const at = new Date(today); at.setDate(at.getDate() - d); at.setHours(9 + ((d + j * 5) % 12), (d * 13 + j * 7) % 60);
      const refunded = (d + j) % 11 === 0, amount = prices[k] * qty;
      out.push({ id: 'DEMO-' + String(seq++).padStart(4, '0'), demo: true, buyer: '데모회원' + ((d + j) % 9 + 1), product: items[k], qty, currency: 'KRW', amountMinor: amount, refundMinor: refunded ? amount : 0, status: refunded ? 'refunded' : 'paid', paidAt: at.toISOString() });
    }
  }
  return out;
}
function listOrders(actor) {
  need(can(actor, 'orders.view'), '권한이 없습니다.');
  return cache.orders.concat(demoEnabled() ? makeDemoOrders() : []);
}
const listAudit = (actor) => { need(can(actor, 'audit.view'), '권한이 없습니다.'); return cache.audit.slice(); };
const health = () => cache.health;

window.ER = {
  ready, ENV, projectId: firebaseConfig.projectId, get loadError() { return loadError; },
  ROLES, WORK_STATUS, POST_TAGS, NEWS_TYPES, GOODS_TYPES, ARTICLE_TYPES, can, pwProblems,
  signup, login, logout, currentUser, loadAdmin,
  listUsers, setUserStatus, setUserRole,
  listWorks, getWork, updateWork,
  listPosts, addPost, deleteOwnPost, reportPost, setPostStatus, listComments, addComment, deleteOwnComment,
  listProducts, getProduct, listArticles, getArticle,
  listNews, addNews, setNewsStatus,
  listOrders, listAudit, demoEnabled, setDemoOrders, health
};

/* ---------- 공용 UI 유틸 ---------- */
window.esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
window.fmtDate = (v) => { const d = new Date(v); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
window.fmtDateTime = (v) => { const d = new Date(v); return `${fmtDate(v)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
window.fmtWon = (n) => n.toLocaleString('ko-KR') + '원';
window.toast = function (msg, type = 'info') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = 'toast toast--' + type;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.classList.add('is-out'), 3200);
  setTimeout(() => t.remove(), 3600);
};
/* 작품 이미지가 없을 때 쓰는 자리표시 그림. 실제 작품처럼 보이지 않도록 '이미지 준비 중' 라벨을 함께 붙인다. */
window.placeholderArt = function (tint, label = '이미지 준비 중') {
  return `<div class="ph" style="--tint:${tint}">
    <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 18c19 0 32 13 32 31 0 19-14 33-32 33S18 68 18 49c0-18 13-31 32-31z" fill="#fff" stroke="#E2D6CA" stroke-width="2.5" stroke-dasharray="5 5"/>
    <circle cx="40" cy="48" r="3.4" fill="#C9BBAE"/><circle cx="60" cy="48" r="3.4" fill="#C9BBAE"/><path d="M43 60q7 6 14 0" stroke="#C9BBAE" stroke-width="3" fill="none" stroke-linecap="round"/></svg>
    ${label ? `<span class="ph__label">${esc(label)}</span>` : ''}</div>`;
};

// main.js(먼저 실행됨)에 데이터 계층 준비를 알린다.
window.dispatchEvent(new Event('er:loaded'));
})();

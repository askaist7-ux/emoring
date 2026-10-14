/* EmoRing 공용 레이아웃(헤더·푸터·메뉴) + 홈·하위 페이지 렌더링 */
const MENU = [
  { label: '이모티콘', items: [{ p: 'collection', label: '승인작 컬렉션' }, { p: 'stories', label: '캐릭터 스토리' }] },
  { label: '굿즈샵', items: [{ p: 'goods-char', label: '캐릭터별 굿즈' }, { p: 'goods-all', label: '전체 굿즈' }] },
  { label: '매거진', items: [{ p: 'interviews', label: '작가 인터뷰' }] },
  { label: '커뮤니티', items: [{ p: 'lounge', label: '팬 라운지' }, { p: 'news', label: '소식·이벤트' }] }
];
const pageUrl = (p, extra = '') => `page.html?p=${p}${extra}`;
const currentP = () => new URLSearchParams(location.search).get('p');

function workTitle(w) { return w.name ? w.name : `작품 ${String(w.no).padStart(2, '0')}`; }
function workStatusBadge(w) {
  const cls = { empty: 'muted', review: 'muted', approved: 'blue', onsale: 'ok', hidden: 'muted' }[w.status];
  return `<span class="badge badge--${cls}">${esc(ER.WORK_STATUS[w.status])}</span>`;
}

/* ---------- 헤더 ---------- */
function renderHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;
  // Firebase 로딩 전에도 메뉴가 보이도록 ER이 없으면 비로그인 상태로 먼저 그린다.
  const user = window.ER ? ER.currentUser() : null;
  const p = currentP();
  const isAdmin = !!(window.ER && ER.can(user, 'admin.access'));
  const util = user
    ? `<span class="util__hello">${esc(user.nickname)}님</span>
       <a href="${pageUrl('mypage')}">마이페이지</a>
       <button type="button" class="linklike" data-logout>로그아웃</button>`
    : `<a href="login.html">로그인</a><a href="signup.html">회원가입</a>`;
  // 관리자 버튼은 항상 표시하고, 권한 확인은 admin.html(로그인·역할 게이트)과 Firestore Rules가 한다.
  const adminBtn = `<a class="util__admin" href="admin.html"${isAdmin ? '' : ' title="관리자 권한이 있는 계정만 이용할 수 있어요"'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 10-4-1.7-7-5.6-7-10V6l7-3z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>관리자</a>`;

  const gnb = MENU.map((m, i) => {
    const active = m.items.some(it => it.p === p);
    return `<li class="gnb__item${active ? ' is-active' : ''}">
      <a class="gnb__link" href="${pageUrl(m.items[0].p)}"${active ? ' aria-current="true"' : ''}>${m.label}</a>
      <button type="button" class="gnb__toggle" aria-expanded="false" aria-controls="gnb-sub-${i}" aria-label="${m.label} 하위 메뉴 열기">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
      <ul class="gnb__sub" id="gnb-sub-${i}">
        ${m.items.map(it => `<li><a href="${pageUrl(it.p)}"${it.p === p ? ' aria-current="page"' : ''}>${it.label}</a></li>`).join('')}
      </ul></li>`;
  }).join('');

  const drawer = MENU.map((m, i) => `
    <div class="acc">
      <button type="button" class="acc__btn" aria-expanded="${m.items.some(it => it.p === p)}" aria-controls="acc-${i}">${m.label}
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
      <ul class="acc__panel" id="acc-${i}" ${m.items.some(it => it.p === p) ? '' : 'hidden'}>
        ${m.items.map(it => `<li><a href="${pageUrl(it.p)}"${it.p === p ? ' aria-current="page"' : ''}>${it.label}</a></li>`).join('')}
      </ul>
    </div>`).join('');

  el.innerHTML = `
  <a class="skip" href="#main">본문 바로가기</a>
  <header class="site-header">
    <div class="util"><div class="container util__in">${util}${adminBtn}</div></div>
    <div class="container hdr">
      <a class="logo" href="index.html" aria-label="EmoRing 홈"><img src="images/logo.png" alt="EmoRing"></a>
      <nav class="gnb" aria-label="주 메뉴"><ul class="gnb__list">${gnb}</ul></nav>
      <div class="hdr__actions">
        <form class="search" role="search" action="page.html">
          <input type="hidden" name="p" value="search">
          <label class="sr-only" for="hdr-q">검색어</label>
          <input id="hdr-q" name="q" type="search" placeholder="작품, 굿즈, 소식 검색" autocomplete="off">
          <button type="submit" aria-label="검색"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        </form>
        <a class="icon-btn search-m" href="${pageUrl('search')}" aria-label="검색"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></a>
        <a class="icon-btn" href="${pageUrl('cart')}" aria-label="장바구니"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2l2 10h10l2-7H7.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="9.5" cy="19" r="1.5" fill="currentColor"/><circle cx="16.5" cy="19" r="1.5" fill="currentColor"/></svg></a>
        <a class="icon-btn admin-m" href="admin.html" aria-label="관리자"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 10-4-1.7-7-5.6-7-10V6l7-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
        <button type="button" class="icon-btn menu-btn" aria-expanded="false" aria-controls="drawer" aria-label="전체 메뉴 열기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
    </div>
  </header>
  <div class="drawer-bg" hidden></div>
  <aside class="drawer" id="drawer" aria-label="전체 메뉴" hidden>
    <div class="drawer__top">
      <img src="images/logo.png" alt="EmoRing" class="drawer__logo">
      <button type="button" class="icon-btn" data-close-drawer aria-label="메뉴 닫기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
    </div>
    <div class="drawer__user">${user
      ? `<strong>${esc(user.nickname)}님</strong><div class="drawer__links"><a href="${pageUrl('mypage')}">마이페이지</a><button type="button" class="linklike" data-logout>로그아웃</button><a href="admin.html">관리자</a></div>`
      : `<p>로그인하고 팬 라운지에 참여해 보세요.</p><div class="drawer__links"><a class="btn btn--primary btn--sm" href="login.html">로그인</a><a class="btn btn--ghost btn--sm" href="signup.html">회원가입</a><a href="admin.html">관리자</a></div>`}</div>
    <nav aria-label="모바일 메뉴">${drawer}</nav>
  </aside>`;

  // 데스크톱 하위 메뉴 펼침 버튼(클릭·키보드)
  el.querySelectorAll('.gnb__toggle').forEach(btn => btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    el.querySelectorAll('.gnb__toggle').forEach(b => { b.setAttribute('aria-expanded', 'false'); b.parentElement.classList.remove('is-open'); });
    if (!open) { btn.setAttribute('aria-expanded', 'true'); btn.parentElement.classList.add('is-open'); }
  }));
  if (!renderHeader.bound) document.addEventListener('click', (e) => {
    if (!e.target.closest('.gnb__item')) el.querySelectorAll('.gnb__item.is-open').forEach(li => { li.classList.remove('is-open'); li.querySelector('.gnb__toggle').setAttribute('aria-expanded', 'false'); });
  });
  renderHeader.bound = true;

  // 모바일 드로어
  const drawerEl = el.querySelector('.drawer'), bg = el.querySelector('.drawer-bg'), menuBtn = el.querySelector('.menu-btn');
  const openDrawer = () => { drawerEl.hidden = false; bg.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); document.body.classList.add('no-scroll'); requestAnimationFrame(() => drawerEl.classList.add('is-open')); drawerEl.querySelector('[data-close-drawer]').focus(); };
  const closeDrawer = () => { drawerEl.classList.remove('is-open'); menuBtn.setAttribute('aria-expanded', 'false'); document.body.classList.remove('no-scroll'); setTimeout(() => { drawerEl.hidden = true; bg.hidden = true; }, 200); menuBtn.focus(); };
  menuBtn.addEventListener('click', openDrawer);
  bg.addEventListener('click', closeDrawer);
  drawerEl.querySelector('[data-close-drawer]').addEventListener('click', closeDrawer);
  drawerEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
    if (e.key === 'Tab') { // 포커스 가두기
      const f = [...drawerEl.querySelectorAll('a,button')].filter(x => x.offsetParent !== null);
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  el.querySelectorAll('.acc__btn').forEach(b => b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') === 'true';
    b.setAttribute('aria-expanded', String(!open));
    document.getElementById(b.getAttribute('aria-controls')).hidden = open;
  }));

  el.querySelectorAll('[data-logout]').forEach(b => b.addEventListener('click', async () => { await ER.logout(); toast('로그아웃했습니다.'); setTimeout(() => location.href = 'index.html', 400); }));
  const q = new URLSearchParams(location.search).get('q');
  if (q) el.querySelector('#hdr-q').value = q;
}

/* ---------- 푸터 ---------- */
function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  el.innerHTML = `
  <footer class="site-footer">
    <div class="container footer__in">
      <div class="footer__brand">
        <img src="images/logo.png" alt="EmoRing" class="footer__logo">
        <p class="footer__by">이모티콘 작가 써니</p>
        <p class="footer__desc">이모티콘 · 캐릭터 굿즈 · 작가 인터뷰 · 팬 커뮤니티</p>
      </div>
      <div class="footer__contact" id="contact">
        <h2 class="footer__h">문의</h2>
        <p>전화 <a href="tel:01026273771">010-2627-3771</a></p>
        <p>이메일 <a href="mailto:e_iiias@naver.com">e_iiias@naver.com</a></p>
      </div>
      <nav class="footer__links" aria-label="정책 및 지원">
        <h2 class="footer__h">고객지원</h2>
        <a href="${pageUrl('support')}">배송·교환·반품 안내</a>
        <a href="mailto:e_iiias@naver.com">고객 문의</a>
        <a href="${pageUrl('policy', '&doc=terms')}">이용약관</a>
        <a href="${pageUrl('policy', '&doc=privacy')}">개인정보처리방침</a>
      </nav>
    </div>
    <div class="container footer__bottom">
      <p>[운영 정보 입력] 사업자명 · 사업자등록번호 · 주소 · 통신판매업 신고번호는 확정 후 표시됩니다.</p>
      <p>© EmoRing. All rights reserved.</p>
    </div>
  </footer>`;
}

/* ---------- 카드 템플릿 ---------- */
function workCard(w, { compact = false } = {}) {
  const art = w.name ? placeholderArt(w.tint, '대표 이미지 등록 전') : placeholderArt(w.tint);
  return `<li class="work${compact ? ' work--compact' : ''}">
    <a href="${pageUrl('work', '&id=' + w.id)}" class="work__link">
      <div class="work__thumb">${art}</div>
      <div class="work__body">
        <span class="work__no">작품 ${String(w.no).padStart(2, '0')}</span>
        <strong class="work__name">${w.name ? esc(w.name) : '작품명 입력 예정'}</strong>
        ${compact ? '' : `<p class="work__concept">${w.concept ? esc(w.concept) : '콘셉트 소개가 곧 등록됩니다.'}</p>`}
        ${workStatusBadge(w)}
      </div>
    </a></li>`;
}
function postRow(p, works) {
  const w = works.find(x => x.id === p.workId);
  return `<li class="post-row">
    <a href="${pageUrl('post', '&id=' + p.id)}">
      <span class="tag">${esc(p.tag)}</span>
      <strong class="post-row__title">${esc(p.title)}</strong>
      <span class="post-row__meta">${p.isArtist ? '<span class="badge badge--coral">작가 써니</span>' : esc(p.author)} · ${fmtDate(p.createdAt)}${w ? ' · ' + esc(workTitle(w)) : ''}</span>
    </a></li>`;
}
function newsRow(n) {
  return `<li class="news-row">
    <a href="${pageUrl('news-detail', '&id=' + n.id)}">
      <span class="news-row__date">${fmtDate(n.createdAt)}</span>
      <span class="news-row__title">${n.important ? '<span class="badge badge--coral">중요</span> ' : ''}${esc(n.title)}</span>
    </a></li>`;
}
function emptyState(title, desc, action = '') {
  return `<div class="empty"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="#FFF1E4" stroke="#F0C9A8" stroke-width="2"/><circle cx="25" cy="30" r="2.6" fill="#B8865F"/><circle cx="39" cy="30" r="2.6" fill="#B8865F"/><path d="M26 39q6 4 12 0" stroke="#B8865F" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>
    <strong>${title}</strong>${desc ? `<p>${desc}</p>` : ''}${action}</div>`;
}

/* ---------- 홈 ---------- */
function renderHome() {
  const works = ER.listWorks();
  const posts = ER.listPosts();
  const news = ER.listNews();

  // 포털: 승인작 미리보기 4×2
  document.getElementById('portal-works').innerHTML = works.map(w => `
    <li><a href="${pageUrl('work', '&id=' + w.id)}" class="mini" style="--tint:${w.tint}" aria-label="${esc(workTitle(w))} 상세 보기">
      <span class="mini__no">${String(w.no).padStart(2, '0')}</span></a></li>`).join('');

  // 포털: 공지
  const notices = news.filter(n => n.type === 'notice').slice(0, 2);
  document.getElementById('portal-notice').innerHTML = notices.length
    ? notices.map(n => `<li class="alert-item"><span class="alert-item__icon" aria-hidden="true">${n.important ? '!' : 'i'}</span>
        <a href="${pageUrl('news-detail', '&id=' + n.id)}">${n.important ? '<span class="sr-only">중요 공지: </span>' : ''}${esc(n.title)}</a></li>`).join('')
    : '<li class="muted-text">등록된 공지가 없습니다.</li>';

  // 포털: 새소식
  const latest = news.slice(0, 3);
  document.getElementById('portal-news').innerHTML = latest.length ? latest.map(newsRow).join('') : '<li class="muted-text">아직 소식이 없어요.</li>';

  // 포털: 팬 라운지
  const lp = posts.slice(0, 3);
  document.getElementById('portal-lounge').innerHTML = lp.length
    ? `<ul class="post-list post-list--tight">${lp.map(p => postRow(p, works)).join('')}</ul>`
    : emptyState('첫 이야기를 기다리고 있어요', '써니 작가에게 응원이나 질문을 남겨 주세요.');

  // 승인작 8종
  document.getElementById('home-works').innerHTML = works.filter(w => w.status !== 'hidden').map(w => workCard(w)).join('');

  // 캐릭터별 굿즈 칩
  const chipWrap = document.getElementById('goods-chips');
  const panel = document.getElementById('goods-panel');
  chipWrap.innerHTML = `<button type="button" class="chip" aria-pressed="true" data-work="">전체</button>` +
    works.map(w => `<button type="button" class="chip" aria-pressed="false" data-work="${w.id}"><span class="chip__dot" style="background:${w.tint}" aria-hidden="true"></span>${esc(workTitle(w))}</button>`).join('');
  const products = ER.listProducts();
  const showGoods = (id) => {
    const w = works.find(x => x.id === id);
    const list = products.filter(p => !id || p.workIds.includes(id)).slice(0, 4);
    panel.innerHTML = list.length ? productGrid(list) + `<a class="text-link gc-more" href="${pageUrl('goods-char', id ? '&work=' + id : '')}">${w ? esc(workTitle(w)) + ' 굿즈 전체 보기' : '캐릭터별 굿즈 전체 보기'}</a>` : emptyState(
      w ? `${esc(workTitle(w))}의 굿즈를 준비하고 있어요` : '굿즈샵 오픈을 준비하고 있어요',
      '실제 판매 상품이 등록되면 이곳에서 바로 만나볼 수 있어요.',
      `<a class="btn btn--ghost btn--sm" href="${pageUrl('goods-char', id ? '&work=' + id : '')}">캐릭터별 굿즈 보기</a>`);
  };
  chipWrap.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    chipWrap.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    showGoods(b.dataset.work);
  });
  showGoods('');

  // 써니의 추천 굿즈(작가가 선정한 실제 판매 상품만)
  const picks = products.filter(p => p.featured && p.status === 'onsale').slice(0, 8);
  const pickEl = document.getElementById('home-picks');
  if (pickEl) pickEl.innerHTML = picks.length ? productGrid(picks)
    : emptyState('추천 굿즈를 고르고 있어요', '실제 판매가 시작된 상품 중에서 써니가 직접 추천할 거예요.', `<a class="btn btn--ghost btn--sm" href="${pageUrl('goods-all')}">전체 굿즈 보기</a>`);

  // 써니 인터뷰
  const arts = ER.listArticles();
  const ivEl = document.getElementById('home-interview');
  if (ivEl) {
    const a = arts.find(x => x.featured) || arts[0];
    ivEl.innerHTML = a ? `<ul>${articleCard(a, true)}</ul>` : `<div class="iv-teaser card"><div class="iv-teaser__art" aria-hidden="true">${sunnyMini()}</div>
      <div><span class="tag">인터뷰</span><strong class="iv-teaser__title">써니라는 작가명에는 어떤 이야기가 있을까요?</strong>
      <p class="muted-text">첫 인터뷰를 준비하고 있어요. 답변은 써니 작가가 직접 전한 이야기로만 채워집니다.</p>
      <div class="link-row"><a class="btn btn--primary btn--sm" href="${pageUrl('interviews')}">창작 노트 보기</a><a class="btn btn--ghost btn--sm" href="${pageUrl('lounge', '&write=1&tag=' + encodeURIComponent('작가에게 질문'))}">작가에게 질문하기</a></div></div></div>`;
  }

  if (ER.currentUser()) {
    const cta = document.querySelector('.cta-banner .btn');
    if (cta) { cta.href = pageUrl('lounge', '&write=1'); cta.textContent = '팬 라운지에 글쓰기'; }
  }
  const sm = document.getElementById('sunny-mini');
  if (sm) sm.innerHTML = sunnyMini();
}

/* ---------- 하위 페이지 ---------- */
const PAGES = {
  collection: { group: '이모티콘', title: '써니의 이모티콘 컬렉션', lead: '대화 속 마음을 전하는 써니의 캐릭터들을 만나보세요.', render: pageCollection },
  stories: { group: '이모티콘', title: '캐릭터 스토리', lead: '캐릭터의 성격과 세계관, 탄생 이야기를 소개합니다.', render: pageStories },
  'goods-char': { group: '굿즈샵', title: '캐릭터별 굿즈', lead: '좋아하는 캐릭터의 굿즈를 찾아보세요.', render: pageGoodsChar },
  'goods-all': { group: '굿즈샵', title: '전체 굿즈', lead: '상품 유형별로 모든 굿즈를 둘러보세요.', render: pageGoodsAll },
  interviews: { group: '매거진', title: '써니의 창작 노트', lead: '작은 표정 하나에 담긴, 작가의 큰 이야기.', render: pageInterviews },
  lounge: { group: '커뮤니티', title: '써니와 팬들의 이야기', lead: '응원, 팬아트, 굿즈 후기, 작가에게 묻고 싶은 것까지 편하게 나눠요.', render: pageLounge },
  news: { group: '커뮤니티', title: '소식·이벤트', lead: '공지, 신작 소식, 굿즈 출시와 이벤트를 알려드려요.', render: pageNews },
  work: { group: '이모티콘', parent: 'collection', title: '', render: pageWork },
  post: { group: '커뮤니티', parent: 'lounge', title: '', render: pagePost },
  'news-detail': { group: '커뮤니티', parent: 'news', title: '', render: pageNewsDetail },
  story: { group: '이모티콘', parent: 'stories', title: '', render: pageStory },
  product: { group: '굿즈샵', parent: 'goods-all', title: '', render: pageProduct },
  interview: { group: '매거진', parent: 'interviews', title: '', render: pageInterview },
  search: { title: '통합 검색', lead: '작품, 굿즈, 매거진, 소식, 팬 라운지 글을 한 번에 찾아보세요.', render: pageSearch },
  mypage: { title: '마이페이지', lead: '주문·찜·내가 쓴 글과 회원 정보를 확인해요.', render: pageMypage },
  cart: { title: '장바구니', lead: '담아 둔 굿즈를 확인해요.', render: pageCart },
  support: { title: '고객지원', lead: '배송·교환·반품 안내와 비공개 문의 방법을 알려드려요.', render: pageSupport },
  policy: { title: '안내', lead: '', render: pagePolicy }
};
const subLabel = (p) => { for (const m of MENU) for (const it of m.items) if (it.p === p) return it.label; return null; };

function renderSubPage() {
  const p = currentP() || 'collection';
  const def = PAGES[p] || PAGES.collection;
  const root = document.getElementById('page-root');
  let shownTitle = '';
  const ctx = { setTitle: (t) => { shownTitle = t; document.getElementById('page-title').textContent = t; document.title = t + ' | EmoRing'; } };

  const crumbs = ['<a href="index.html">홈</a>'];
  if (def.group) crumbs.push(`<span>${def.group}</span>`);
  if (def.parent) crumbs.push(`<a href="${pageUrl(def.parent)}">${subLabel(def.parent)}</a>`);
  else if (subLabel(p)) crumbs.push(`<span aria-current="page">${subLabel(p)}</span>`);
  document.getElementById('crumbs').innerHTML = crumbs.join('<span class="crumbs__sep" aria-hidden="true">›</span>');

  // 같은 대메뉴의 소메뉴 탭
  const group = MENU.find(m => m.items.some(it => it.p === (def.parent || p)));
  document.getElementById('subnav').innerHTML = group && group.items.length > 1
    ? `<nav aria-label="${group.label} 소메뉴" class="subtabs">${group.items.map(it => `<a href="${pageUrl(it.p)}"${it.p === (def.parent || p) ? ' aria-current="page"' : ''}>${it.label}</a>`).join('')}</nav>` : '';

  ctx.setTitle(def.title || 'EmoRing');
  document.getElementById('page-lead').textContent = def.lead || '';
  def.render(root, ctx);
  // 상세 화면: 홈 › 대메뉴 › 소메뉴 › 현재 항목
  if (def.parent && shownTitle) document.getElementById('crumbs').insertAdjacentHTML('beforeend', `<span class="crumbs__sep" aria-hidden="true">›</span><span aria-current="page">${esc(shownTitle)}</span>`);
  else if (!def.group) document.getElementById('crumbs').insertAdjacentHTML('beforeend', `<span class="crumbs__sep" aria-hidden="true">›</span><span aria-current="page">${esc(shownTitle)}</span>`);
}

/* ---------- 공용 도우미 ---------- */
const qp = (k) => new URLSearchParams(location.search).get(k) || '';
function setParams(obj) { // 필터 상태를 주소에 저장(새로고침·공유·뒤로가기 지원)
  const u = new URL(location.href);
  Object.entries(obj).forEach(([k, v]) => { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); });
  history.replaceState(null, '', u);
}
const nl2br = (t) => esc(t).replace(/\n/g, '<br>');
const won = (n) => (n == null ? '가격 확인 중' : fmtWon(n));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const CART_KEY = 'er.cart', WISH_KEY = 'er.wish';
const loginUrl = () => 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);

function productThumb(p, label = '상품 사진 준비 중') {
  const w = ER.getWork(p.workIds[0]);
  return p.images[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.name)} 상품 사진" loading="lazy">` : placeholderArt(w ? w.tint : '#F1EAE2', label);
}
function discountOf(p) { return p.listPrice && p.price != null && p.listPrice > p.price ? Math.round((1 - p.price / p.listPrice) * 100) : 0; }
function priceHtml(p) {
  const d = discountOf(p);
  return `${d ? `<b class="price__disc">${d}%</b> ` : ''}<strong class="price__now">${won(p.price)}</strong>${d ? ` <s class="price__list"><span class="sr-only">정상가 </span>${fmtWon(p.listPrice)}</s>` : ''}`;
}
function productCard(p) {
  const works = p.workIds.map(id => ER.getWork(id)).filter(Boolean);
  const sold = p.status === 'soldout';
  return `<li class="prod"><a class="prod__link" href="${pageUrl('product', '&id=' + p.id)}">
    <div class="prod__thumb">${productThumb(p)}</div>
    <div class="prod__body">
      <span class="prod__work">${works.length ? esc(works.map(workTitle).join(' · ')) : esc(p.type)}</span>
      <strong class="prod__name">${esc(p.name)}</strong>
      <span class="price">${priceHtml(p)}</span>
      ${sold ? '<span class="badge badge--muted">품절</span>' : p.digital ? '<span class="badge badge--blue">디지털</span>' : ''}
    </div></a></li>`;
}
const productGrid = (list) => `<ul class="prod-grid">${list.map(productCard).join('')}</ul>`;

function eventState(n) {
  if (n.type !== 'event' || !n.startAt || !n.endAt) return null;
  const now = Date.now(), s = +new Date(n.startAt), e = +new Date(n.endAt);
  if (now < s) return { key: 'soon', label: '예정', cls: 'blue' };
  if (now > e) return { key: 'ended', label: '종료', cls: 'muted' };
  return { key: 'live', label: '진행 중', cls: 'ok' };
}
function prevNext(list, idx, href, label) {
  const prev = list[idx + 1], next = list[idx - 1];
  if (!prev && !next) return '';
  return `<nav class="prevnext" aria-label="이전·다음 ${label}">
    ${prev ? `<a href="${href(prev)}"><span>이전 ${label}</span><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}
    ${next ? `<a href="${href(next)}" class="prevnext__next"><span>다음 ${label}</span><strong>${esc(next.title)}</strong></a>` : '<span></span>'}</nav>`;
}
function relatedBlock(workIds, productIds) {
  const works = (workIds || []).map(id => ER.getWork(id)).filter(w => w && w.status !== 'hidden');
  const prods = (productIds || []).map(id => ER.getProduct(id)).filter(Boolean);
  if (!works.length && !prods.length) return ''; // 관련 대상이 없으면 빈 링크를 표시하지 않는다.
  return `<section class="sub-section"><h2 class="h-section">관련 작품·굿즈</h2>
    ${works.length ? `<ul class="work-grid">${works.map(w => workCard(w, { compact: true })).join('')}</ul>` : ''}
    ${prods.length ? productGrid(prods) : ''}</section>`;
}
function articleCard(a, big = false) {
  return `<li class="acard${big ? ' acard--big' : ''}"><a href="${pageUrl('interview', '&id=' + a.id)}">
    <div class="acard__cover" aria-hidden="true">${sunnyMini()}</div>
    <div class="acard__body"><span class="tag">${esc(a.type)}</span>
      <strong class="acard__title">${esc(a.title)}</strong>
      ${a.summary ? `<p class="acard__sum">${esc(a.summary)}</p>` : ''}
      <span class="acard__date">${fmtDate(a.createdAt)}</span></div></a></li>`;
}

/* ---------- 이모티콘 ---------- */
function pageCollection(root) {
  const works = ER.listWorks().filter(w => w.status !== 'hidden');
  const opts = [['', '전체'], ['onsale', '판매 중'], ['approved', '승인 · 출시 대기'], ['ready', '자료 준비 중']];
  let st = qp('status');
  root.innerHTML = `<p class="note">‘승인’과 ‘판매 중’은 다른 상태예요. 공식 판매처 링크는 판매가 확인된 작품에만 표시됩니다.</p>
    <div class="chips" role="group" aria-label="상태 필터" id="cl-chips"></div>
    <p class="result-count" aria-live="polite" id="cl-count"></p>
    <div id="cl-list"></div>`;
  const draw = () => {
    root.querySelector('#cl-chips').innerHTML = opts.map(([k, v]) => `<button type="button" class="chip" data-st="${k}" aria-pressed="${k === st}">${v}</button>`).join('');
    const list = works.filter(w => !st || (st === 'ready' ? ['empty', 'review'].includes(w.status) : w.status === st));
    root.querySelector('#cl-count').textContent = `작품 ${list.length}개`;
    root.querySelector('#cl-list').innerHTML = list.length ? `<ul class="work-grid">${list.map(w => workCard(w)).join('')}</ul>`
      : emptyState('이 상태의 작품이 아직 없어요', '다른 상태를 선택해 보세요.', '<button type="button" class="btn btn--ghost btn--sm" data-st="">전체 작품 보기</button>');
  };
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b) return; st = b.dataset.st; setParams({ status: st }); draw(); });
  draw();
}

function pageWork(root, ctx) {
  const all = ER.listWorks().filter(x => x.status !== 'hidden');
  const w = ER.getWork(qp('id'));
  if (!w || w.status === 'hidden') { root.innerHTML = emptyState('작품을 찾을 수 없어요', '비공개 처리되었거나 없는 작품입니다.', `<a class="btn btn--primary btn--sm" href="${pageUrl('collection')}">컬렉션으로 돌아가기</a>`); return; }
  ctx.setTitle(workTitle(w) + (w.name ? '' : ' · 작품명 입력 예정'));
  document.getElementById('page-lead').textContent = w.concept || '작품 소개가 곧 등록됩니다.';
  const goods = ER.listProducts().filter(p => p.workIds.includes(w.id));
  const articles = ER.listArticles().filter(a => a.workIds.includes(w.id));
  const posts = ER.listPosts().filter(p => p.workId === w.id).slice(0, 5);
  const i = all.indexOf(w), prev = all[i - 1], next = all[i + 1];
  root.innerHTML = `
  <div class="detail">
    <div class="detail__media">${placeholderArt(w.tint, w.name ? '대표 이미지 등록 전' : '이미지 준비 중')}</div>
    <div class="detail__info card">
      <span class="work__no">작품 ${String(w.no).padStart(2, '0')}</span>
      <h2 class="detail__name">${w.name ? esc(w.name) : '작품명 입력 예정'}</h2>
      <dl class="kv">
        <div><dt>상태</dt><dd>${workStatusBadge(w)}</dd></div>
        <div><dt>승인 플랫폼</dt><dd>${w.platform ? esc(w.platform) : '확인 후 표시'}</dd></div>
        <div><dt>관련 굿즈</dt><dd>${goods.length ? `${goods.length}개` : '준비 중'}</dd></div>
      </dl>
      ${w.status === 'onsale' && w.saleUrl
        ? `<a class="btn btn--primary btn--block" href="${esc(w.saleUrl)}" target="_blank" rel="noopener noreferrer">공식 판매처에서 보기<span class="sr-only"> (새 창)</span></a>`
        : `<p class="note note--soft">공식 판매처 링크는 판매가 확인되면 표시됩니다.</p>`}
      <a class="btn btn--ghost btn--block" href="${pageUrl('goods-char', '&work=' + w.id)}">이 캐릭터의 굿즈 보기</a>
      <a class="text-link" href="${pageUrl('story', '&id=' + w.id)}">캐릭터 스토리 읽기</a>
    </div>
  </div>
  <section class="sub-section"><h2 class="h-section">대표 이모티콘 미리보기</h2>
    ${emptyState('미리보기 이미지를 준비하고 있어요', '원본 비율과 이미지 속 문구를 그대로 살린 미리보기가 등록될 예정이에요.')}</section>
  <section class="sub-section"><h2 class="h-section">캐릭터 이야기</h2>
    ${w.story ? `<div class="card prose">${nl2br(w.story)}</div>` : emptyState('캐릭터 스토리를 준비하고 있어요', '작가가 직접 정리한 성격과 사용 상황, 제작 이야기가 곧 공개됩니다.')}</section>
  <section class="sub-section"><h2 class="h-section">이 작품의 굿즈</h2>
    ${goods.length ? productGrid(goods.slice(0, 4)) : emptyState('이 캐릭터의 굿즈를 준비하고 있어요', '출시 소식은 소식·이벤트에서 가장 먼저 알려드릴게요.')}</section>
  ${articles.length ? `<section class="sub-section"><h2 class="h-section">관련 인터뷰</h2><ul class="acard-grid">${articles.slice(0, 3).map(a => articleCard(a)).join('')}</ul></section>` : ''}
  <section class="sub-section"><h2 class="h-section">팬 라운지의 이 작품 이야기</h2>
    ${posts.length ? `<ul class="post-list">${posts.map(p => postRow(p, ER.listWorks())).join('')}</ul><a class="text-link" href="${pageUrl('lounge', '&work=' + w.id)}">이 작품 글 모두 보기</a>`
      : emptyState('아직 이 작품에 대한 글이 없어요', '', `<a class="btn btn--primary btn--sm" href="${pageUrl('lounge', '&write=1&work=' + w.id)}">첫 글 남기기</a>`)}</section>
  <nav class="prevnext" aria-label="이전·다음 작품">
    ${prev ? `<a href="${pageUrl('work', '&id=' + prev.id)}"><span>이전 작품</span><strong>${esc(workTitle(prev))}</strong></a>` : '<span></span>'}
    ${next ? `<a href="${pageUrl('work', '&id=' + next.id)}" class="prevnext__next"><span>다음 작품</span><strong>${esc(workTitle(next))}</strong></a>` : '<span></span>'}</nav>`;
}

function pageStories(root) {
  const works = ER.listWorks().filter(w => w.status !== 'hidden');
  root.innerHTML = `<ul class="story-grid">${works.map(w => `
    <li class="story card">
      <div class="story__art">${placeholderArt(w.tint)}</div>
      <div><span class="work__no">작품 ${String(w.no).padStart(2, '0')}</span>
      <h2 class="story__title">${esc(workTitle(w))}</h2>
      <p class="story__text">${w.story ? esc(w.story.slice(0, 90)) + (w.story.length > 90 ? '…' : '') : '작가가 정리한 설정이 곧 공개돼요.'}</p>
      <div class="story__foot">${w.story ? '' : '<span class="badge badge--muted">준비 중</span>'}<a class="text-link" href="${pageUrl('story', '&id=' + w.id)}">스토리 보기<span class="sr-only"> ${esc(workTitle(w))}</span></a></div></div>
    </li>`).join('')}</ul>`;
}

function pageStory(root, ctx) {
  const all = ER.listWorks().filter(x => x.status !== 'hidden');
  const w = ER.getWork(qp('id'));
  if (!w || w.status === 'hidden') { root.innerHTML = emptyState('캐릭터를 찾을 수 없어요', '', `<a class="btn btn--primary btn--sm" href="${pageUrl('stories')}">스토리 목록으로</a>`); return; }
  ctx.setTitle(workTitle(w) + ' 이야기');
  document.getElementById('page-lead').textContent = w.concept || '';
  const slots = [['탄생 배경', '이 캐릭터가 어떻게 태어났는지'], ['성격 키워드', '캐릭터를 설명하는 세 가지 단어'], ['좋아하는 것 · 싫어하는 것', '캐릭터의 취향'],
    ['주로 표현하는 감정', '대화에서 전하는 마음'], ['대표 대사와 표정', '자주 쓰는 말과 표정'], ['스케치와 제작 과정', '작가의 메모와 작업 흔적']];
  const i = all.indexOf(w);
  root.innerHTML = `
  <div class="story-hero card">
    <div class="story-hero__art">${placeholderArt(w.tint, '대표 장면 준비 중')}</div>
    <div><span class="work__no">작품 ${String(w.no).padStart(2, '0')}</span><h2 class="detail__name">${esc(workTitle(w))}</h2>
      ${w.story ? `<div class="prose">${nl2br(w.story)}</div>` : '<p class="muted-text">써니 작가가 직접 정리한 설정이 등록되면 이곳에 공개됩니다. 없는 설정을 지어내 소개하지 않아요.</p>'}</div>
  </div>
  <ul class="slot-grid">${slots.map(([t, d]) => `<li class="slot"><h3 class="slot__title">${t}</h3><p>${d}</p><span class="badge badge--muted">준비 중</span></li>`).join('')}</ul>
  <div class="link-row">
    <a class="btn btn--primary btn--sm" href="${pageUrl('work', '&id=' + w.id)}">작품 상세 보기</a>
    <a class="btn btn--ghost btn--sm" href="${pageUrl('goods-char', '&work=' + w.id)}">이 캐릭터의 굿즈</a>
  </div>
  <section class="sub-section"><h2 class="h-section">다른 캐릭터</h2>
    <div class="chips">${all.filter((_, k) => k !== i).map(x => `<a class="chip" href="${pageUrl('story', '&id=' + x.id)}"><span class="chip__dot" style="background:${x.tint}" aria-hidden="true"></span>${esc(workTitle(x))}</a>`).join('')}</div></section>`;
}

/* ---------- 굿즈샵 ---------- */
function goodsTypeGuide() {
  const rows = [['문구', '스티커 · 메모지 · 엽서 · 노트'], ['소품', '아크릴 키링 · 스마트톡 · 뱃지'], ['리빙', '머그컵 · 쿠션 · 코스터'], ['패션', '에코백 · 파우치 · 티셔츠'], ['디지털', '배경화면 · 디지털 스티커']];
  return `<section class="sub-section"><h2 class="h-section">준비 중인 품목</h2>
    <p class="muted-text">아래는 기획 중인 품목이며 판매가 확정된 목록이 아니에요. 실제 판매 상품만 가격과 함께 게시됩니다.</p>
    <ul class="type-grid">${rows.map(([t, d]) => `<li class="type-card"><strong>${t}</strong><span>${d}</span></li>`).join('')}</ul></section>`;
}

function pageGoodsChar(root) {
  const works = ER.listWorks().filter(w => w.status !== 'hidden');
  const all = ER.listProducts();
  let sel = qp('work');
  root.innerHTML = `<div class="chips" role="group" aria-label="작품 선택" id="gc-chips"></div><p class="result-count" aria-live="polite" id="gc-count"></p><div id="gc-panel"></div>${all.length ? '' : goodsTypeGuide()}`;
  const draw = () => {
    root.querySelector('#gc-chips').innerHTML = `<button type="button" class="chip" aria-pressed="${!sel}" data-work="">전체</button>` +
      works.map(w => `<button type="button" class="chip" aria-pressed="${sel === w.id}" data-work="${w.id}"><span class="chip__dot" style="background:${w.tint}" aria-hidden="true"></span>${esc(workTitle(w))}</button>`).join('');
    const w = works.find(x => x.id === sel);
    const list = all.filter(p => !sel || p.workIds.includes(sel));
    root.querySelector('#gc-count').textContent = `상품 ${list.length}개`;
    root.querySelector('#gc-panel').innerHTML = list.length
      ? productGrid(list) + (w ? `<a class="text-link gc-more" href="${pageUrl('work', '&id=' + w.id)}">${esc(workTitle(w))} 원작 보기</a>` : '')
      : emptyState(w ? `${esc(workTitle(w))}의 굿즈를 준비하고 있어요` : '판매 중인 굿즈가 아직 없어요',
        '이 캐릭터의 굿즈를 준비하고 있어요. 출시 소식은 소식·이벤트에서 가장 먼저 알려드릴게요.',
        `<a class="btn btn--ghost btn--sm" href="${pageUrl('news', '&type=goods')}">굿즈 출시 소식 보기</a>`);
  };
  root.querySelector('#gc-chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    sel = b.dataset.work; setParams({ work: sel }); draw();
  });
  draw();
}

function pageGoodsAll(root) {
  const works = ER.listWorks().filter(w => w.status !== 'hidden');
  const all = ER.listProducts();
  const f = { q: qp('q'), work: qp('work'), type: qp('type'), min: qp('min'), max: qp('max'), avail: qp('avail'), sort: qp('sort') || 'new' };
  root.innerHTML = `
  <form class="filters card" id="ga-form" role="search">
    <div class="field"><label for="ga-q">검색</label><input id="ga-q" name="q" type="search" placeholder="상품명, 작품명, 설명" value="${esc(f.q)}"></div>
    <div class="field"><label for="ga-work">작품</label><select id="ga-work" name="work"><option value="">전체 작품</option>${works.map(w => `<option value="${w.id}"${w.id === f.work ? ' selected' : ''}>${esc(workTitle(w))}</option>`).join('')}</select></div>
    <div class="field"><label for="ga-type">상품 유형</label><select id="ga-type" name="type"><option value="">전체</option>${ER.GOODS_TYPES.map(t => `<option${t === f.type ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="field field--range"><span class="field__label" id="ga-price-l">가격 (원)</span>
      <div class="range" role="group" aria-labelledby="ga-price-l"><label class="sr-only" for="ga-min">최소 가격</label><input id="ga-min" name="min" type="number" min="0" step="1000" inputmode="numeric" placeholder="최소" value="${esc(f.min)}"><span aria-hidden="true">~</span><label class="sr-only" for="ga-max">최대 가격</label><input id="ga-max" name="max" type="number" min="0" step="1000" inputmode="numeric" placeholder="최대" value="${esc(f.max)}"></div></div>
    <div class="field"><label for="ga-sort">정렬</label><select id="ga-sort" name="sort"><option value="new"${f.sort === 'new' ? ' selected' : ''}>최신순</option><option value="low"${f.sort === 'low' ? ' selected' : ''}>낮은 가격순</option><option value="high"${f.sort === 'high' ? ' selected' : ''}>높은 가격순</option></select></div>
    <div class="field field--check"><label><input type="checkbox" id="ga-avail" name="avail"${f.avail ? ' checked' : ''}> 구매 가능한 상품만</label></div>
    <button type="button" class="btn btn--ghost btn--sm" id="ga-reset">필터 초기화</button>
  </form>
  <p class="result-count" aria-live="polite" id="ga-count"></p>
  <div id="ga-panel"></div>${all.length ? '' : goodsTypeGuide()}`;
  const form = root.querySelector('#ga-form');
  const read = () => {
    f.q = form.q.value.trim(); f.work = form.work.value; f.type = form.type.value; f.min = form.min.value; f.max = form.max.value;
    f.avail = form.avail.checked ? '1' : ''; f.sort = form.sort.value;
    setParams({ q: f.q, work: f.work, type: f.type, min: f.min, max: f.max, avail: f.avail, sort: f.sort === 'new' ? '' : f.sort });
    draw();
  };
  const draw = () => {
    const lq = f.q.toLowerCase();
    let list = all.filter(p => {
      const names = p.workIds.map(id => ER.getWork(id)).filter(Boolean).map(workTitle).join(' ');
      if (lq && !(p.name + ' ' + names + ' ' + p.summary + ' ' + p.description).toLowerCase().includes(lq)) return false;
      if (f.work && !p.workIds.includes(f.work)) return false;
      if (f.type && p.type !== f.type) return false;
      if (f.min && (p.price == null || p.price < +f.min)) return false;
      if (f.max && (p.price == null || p.price > +f.max)) return false;
      if (f.avail && p.status !== 'onsale') return false;
      return true;
    });
    if (f.sort === 'low') list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (f.sort === 'high') list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    const applied = [f.q && `‘${f.q}’`, f.work && workTitle(ER.getWork(f.work) || { no: 0 }), f.type, (f.min || f.max) && `${f.min || 0}~${f.max || ''}원`, f.avail && '구매 가능'].filter(Boolean);
    root.querySelector('#ga-count').textContent = `상품 ${list.length}개${applied.length ? ' · 적용한 조건: ' + applied.join(', ') : ''}`;
    root.querySelector('#ga-panel').innerHTML = list.length ? productGrid(list)
      : all.length ? emptyState('조건에 맞는 상품이 없어요', '조건을 해제하거나 다른 작품을 둘러보세요.', '<button type="button" class="btn btn--ghost btn--sm" data-reset>필터 초기화</button>')
        : emptyState('판매 중인 굿즈가 아직 없어요', '굿즈샵은 오픈을 준비하고 있어요. 실제 판매 상품이 등록되면 이곳에 표시됩니다.', `<a class="btn btn--ghost btn--sm" href="${pageUrl('collection')}">작품 먼저 둘러보기</a>`);
  };
  const reset = () => { form.reset(); ['q', 'min', 'max'].forEach(k => form[k].value = ''); form.work.value = ''; form.type.value = ''; form.sort.value = 'new'; form.avail.checked = false; read(); };
  form.addEventListener('change', read);
  form.addEventListener('submit', (e) => { e.preventDefault(); read(); });
  form.q.addEventListener('input', () => { clearTimeout(form._t); form._t = setTimeout(read, 250); });
  root.querySelector('#ga-reset').addEventListener('click', reset);
  root.addEventListener('click', (e) => { if (e.target.closest('[data-reset]')) reset(); });
  draw();
}

function pageProduct(root, ctx) {
  const p = ER.getProduct(qp('id'));
  if (!p) { root.innerHTML = emptyState('상품을 찾을 수 없어요', '판매가 종료되었거나 아직 공개되지 않은 상품입니다.', `<a class="btn btn--primary btn--sm" href="${pageUrl('goods-all')}">전체 굿즈 보기</a>`); return; }
  ctx.setTitle(p.name);
  document.getElementById('page-lead').textContent = p.summary;
  const works = p.workIds.map(id => ER.getWork(id)).filter(w => w && w.status !== 'hidden');
  const sold = p.status === 'soldout';
  const hasOpts = p.options.length > 0;
  const same = ER.listProducts().filter(x => x.id !== p.id && x.workIds.some(id => p.workIds.includes(id))).slice(0, 4);
  const wished = store.get(WISH_KEY).includes(p.id);
  const imgs = p.images.length ? p.images : [null];
  root.innerHTML = `
  <div class="detail pdetail">
    <div class="gallery">
      <div class="gallery__main">${imgs[0] ? `<img src="${esc(imgs[0])}" alt="${esc(p.name)} 상품 사진 1">` : productThumb(p)}</div>
      ${imgs.length > 1 ? `<ul class="gallery__thumbs">${imgs.map((src, i) => `<li><button type="button" data-img="${i}" aria-label="사진 ${i + 1} 보기" aria-pressed="${i === 0}"><img src="${esc(src)}" alt=""></button></li>`).join('')}</ul>` : ''}
    </div>
    <form class="detail__info card buybox" id="buy" novalidate>
      <div class="buybox__works">${works.map(w => `<a class="tag" href="${pageUrl('work', '&id=' + w.id)}">${esc(workTitle(w))}</a>`).join(' ')}${p.type ? ` <span class="tag tag--plain">${esc(p.type)}</span>` : ''}</div>
      <h2 class="detail__name">${esc(p.name)}</h2>
      <p class="price price--lg">${priceHtml(p)}</p>
      <p>${sold ? '<span class="badge badge--muted">품절</span> 현재 구매할 수 없는 상품이에요.' : '<span class="badge badge--ok">판매 중</span>'}${p.madeToOrder ? ` <span class="badge badge--warn">주문제작 · ${esc(p.madeToOrder)}</span>` : ''}</p>
      ${hasOpts ? `<div class="field"><label for="opt">옵션</label><select id="opt" name="opt" ${sold ? 'disabled' : ''}><option value="">옵션을 선택해 주세요</option>${p.options.map((o, i) => `<option value="${i}"${o.soldOut ? ' disabled' : ''}>${esc(o.label)}${o.soldOut ? ' (품절)' : ''}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label for="qty">수량</label>
        <div class="qty"><button type="button" data-q="-1" aria-label="수량 줄이기" ${sold ? 'disabled' : ''}>−</button><input id="qty" name="qty" type="number" min="1" max="99" value="1" inputmode="numeric" ${sold ? 'disabled' : ''}><button type="button" data-q="1" aria-label="수량 늘리기" ${sold ? 'disabled' : ''}>+</button></div></div>
      <div class="buybox__total"><span>구매 금액</span><strong id="total" aria-live="polite">${won(p.price)}</strong></div>
      <p class="form-error" role="alert" id="buy-err"></p>
      <div class="buybox__actions">
        <button type="submit" class="btn btn--primary" ${sold || p.price == null ? 'disabled' : ''}>장바구니 담기</button>
        <button type="button" class="btn btn--ghost" id="wish" aria-pressed="${wished}">${wished ? '♥ 찜함' : '♡ 찜하기'}</button>
      </div>
      <p class="muted-text">바로 구매(결제)는 결제 연동 후 열려요. 장바구니에 담아 두면 결제가 시작될 때 이어서 주문할 수 있어요.</p>
    </form>
  </div>
  <section class="sub-section"><h2 class="h-section">상품 정보</h2>
    <div class="card">
      ${p.description ? `<div class="prose">${nl2br(p.description)}</div>` : '<p class="muted-text">상세 설명을 준비하고 있어요.</p>'}
      <dl class="kv kv--left">
        ${p.material ? `<div><dt>소재</dt><dd>${esc(p.material)}</dd></div>` : ''}${p.size ? `<div><dt>크기</dt><dd>${esc(p.size)}</dd></div>` : ''}
        ${p.components ? `<div><dt>구성품</dt><dd>${esc(p.components)}</dd></div>` : ''}${p.caution ? `<div><dt>주의사항</dt><dd>${esc(p.caution)}</dd></div>` : ''}
      </dl></div></section>
  <section class="sub-section"><h2 class="h-section">${p.digital ? '수령·다운로드 안내' : '배송·교환·반품'}</h2>
    <div class="card prose">${p.shipping ? nl2br(p.shipping) : p.digital
      ? '디지털 상품은 배송지 없이 결제 완료 후 마이페이지의 디지털 구매 내역에서 받을 수 있어요. 파일 형식·해상도·사용 범위는 상품 정보를 확인해 주세요.'
      : `배송비·출고 일정·교환 및 반품 기준은 운영 정책이 확정되면 표시됩니다. <a href="${pageUrl('support')}">고객지원 안내 보기</a>`}</div></section>
  <section class="sub-section"><h2 class="h-section">구매 후기 · 상품 문의</h2>
    <div class="two-col">
      ${emptyState('아직 후기가 없어요', '구매가 확인된 회원의 후기만 ‘구매 확인’과 함께 표시됩니다.')}
      ${emptyState('상품 문의', '배송·결제처럼 개인정보가 필요한 문의는 비공개로 받아요.', '<a class="btn btn--ghost btn--sm" href="mailto:e_iiias@naver.com">이메일로 문의하기</a>')}
    </div></section>
  ${same.length ? `<section class="sub-section"><h2 class="h-section">같은 캐릭터의 다른 상품</h2>${productGrid(same)}</section>` : ''}
  ${works.length ? `<section class="sub-section"><h2 class="h-section">원작 이모티콘</h2><ul class="work-grid">${works.map(w => workCard(w, { compact: true })).join('')}</ul></section>` : ''}
  ${sold ? '' : `<div class="buybar" aria-hidden="true"><span class="price">${priceHtml(p)}</span><a class="btn btn--primary btn--sm" href="#buy" tabindex="-1">옵션 선택</a></div>`}`;

  const form = root.querySelector('#buy'), qty = form.qty, err = root.querySelector('#buy-err');
  const clampQty = () => { qty.value = Math.min(99, Math.max(1, parseInt(qty.value, 10) || 1)); };
  const upd = () => { clampQty(); root.querySelector('#total').textContent = p.price == null ? '가격 확인 중' : fmtWon(p.price * qty.value); };
  form.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (!b) return; qty.value = (+qty.value || 1) + +b.dataset.q; upd(); });
  qty.addEventListener('change', upd);
  form.addEventListener('submit', (e) => {
    e.preventDefault(); err.textContent = '';
    if (hasOpts && form.opt.value === '') { err.textContent = '옵션을 선택해 주세요.'; form.opt.focus(); return; }
    clampQty();
    const opt = hasOpts ? p.options[+form.opt.value].label : '';
    const cart = store.get(CART_KEY);
    const hit = cart.find(x => x.id === p.id && x.opt === opt);
    if (hit) hit.qty = Math.min(99, hit.qty + +qty.value); else cart.push({ id: p.id, opt, qty: +qty.value });
    if (store.set(CART_KEY, cart)) toast('장바구니에 담았어요.', 'ok'); else toast('이 브라우저에서는 장바구니를 저장할 수 없어요.', 'err');
  });
  root.querySelector('#wish').addEventListener('click', (e) => {
    const list = store.get(WISH_KEY), on = !list.includes(p.id);
    store.set(WISH_KEY, on ? list.concat(p.id) : list.filter(x => x !== p.id));
    e.currentTarget.setAttribute('aria-pressed', String(on)); e.currentTarget.textContent = on ? '♥ 찜함' : '♡ 찜하기';
    toast(on ? '찜한 상품에 추가했어요.' : '찜을 해제했어요.');
  });
  root.querySelectorAll('[data-img]').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.img;
    root.querySelector('.gallery__main').innerHTML = `<img src="${esc(imgs[i])}" alt="${esc(p.name)} 상품 사진 ${i + 1}">`;
    root.querySelectorAll('[data-img]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
}

function pageCart(root) {
  const draw = () => {
    const cart = store.get(CART_KEY);
    if (!cart.length) { root.innerHTML = emptyState('장바구니가 비어 있어요', '마음에 드는 굿즈를 담아 보세요.', `<a class="btn btn--primary btn--sm" href="${pageUrl('goods-all')}">전체 굿즈 보기</a>`); return; }
    let sum = 0, unknown = false;
    const rows = cart.map((c, i) => {
      const p = ER.getProduct(c.id);
      if (!p) return `<li class="cart-row cart-row--gone"><div><strong>판매가 종료되었거나 비공개된 상품</strong><p class="muted-text">주문할 수 없어요. 목록에서 지워 주세요.</p></div><button type="button" class="btn btn--ghost btn--sm" data-del="${i}">삭제</button></li>`;
      const avail = p.status === 'onsale' && !(c.opt && (p.options.find(o => o.label === c.opt) || {}).soldOut);
      if (p.price == null) unknown = true; else if (avail) sum += p.price * c.qty;
      return `<li class="cart-row"><a class="cart-row__thumb" href="${pageUrl('product', '&id=' + p.id)}">${productThumb(p, '')}</a>
        <div class="cart-row__info"><a href="${pageUrl('product', '&id=' + p.id)}"><strong>${esc(p.name)}</strong></a>${c.opt ? `<span class="muted-text">옵션: ${esc(c.opt)}</span>` : ''}
          ${avail ? '' : '<span class="badge badge--muted">품절 · 주문 불가</span>'}</div>
        <div class="qty qty--sm"><button type="button" data-dq="${i}" data-d="-1" aria-label="${esc(p.name)} 수량 줄이기">−</button><span aria-live="polite"><span class="sr-only">수량 </span>${c.qty}</span><button type="button" data-dq="${i}" data-d="1" aria-label="${esc(p.name)} 수량 늘리기">+</button></div>
        <strong class="cart-row__price">${p.price == null ? '가격 확인 중' : fmtWon(p.price * c.qty)}</strong>
        <button type="button" class="icon-btn" data-del="${i}" aria-label="${esc(p.name)} 삭제"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></li>`;
    }).join('');
    root.innerHTML = `<div class="cart">
      <ul class="cart-list card">${rows}</ul>
      <aside class="card cart-sum" aria-label="결제 예정 금액">
        <dl class="kv"><div><dt>상품 금액</dt><dd>${fmtWon(sum)}${unknown ? ' +α' : ''}</dd></div><div><dt>배송비</dt><dd>주문 단계에서 확인</dd></div></dl>
        <button type="button" class="btn btn--primary btn--block" disabled>주문하기 (결제 준비 중)</button>
        <p class="muted-text">결제는 결제사 연동이 끝나면 열려요. 담아 둔 상품은 이 브라우저에 보관됩니다.</p>
      </aside></div>`;
  };
  root.addEventListener('click', (e) => {
    const cart = store.get(CART_KEY);
    const d = e.target.closest('[data-del]'), q = e.target.closest('[data-dq]');
    if (d) { cart.splice(+d.dataset.del, 1); store.set(CART_KEY, cart); draw(); toast('장바구니에서 뺐어요.'); }
    if (q) { const c = cart[+q.dataset.dq]; c.qty = Math.min(99, Math.max(1, c.qty + +q.dataset.d)); store.set(CART_KEY, cart); draw(); }
  });
  draw();
}

/* ---------- 매거진 ---------- */
function pageInterviews(root) {
  const qs = ['써니라는 작가명에는 어떤 이야기가 있나요?', '이모티콘을 만들기 시작한 계기는 무엇인가요?', '첫 승인 소식을 들었을 때 어떤 마음이었나요?', '작품 8종은 각각 어떤 감정과 상황에서 출발했나요?', '캐릭터의 표정과 대사는 어떻게 정하나요?', '이모티콘을 굿즈로 만들 때 가장 중요하게 생각하는 것은 무엇인가요?', '팬들에게 듣고 싶은 이야기와 전하고 싶은 말은 무엇인가요?', '앞으로 EmoRing에서 어떤 경험을 선보이고 싶나요?'];
  const all = ER.listArticles();
  let type = qp('type');
  const askUrl = pageUrl('lounge', '&write=1&tag=' + encodeURIComponent('작가에게 질문'));
  root.innerHTML = `
  <div class="profile card">
    <div class="profile__avatar" aria-hidden="true">${sunnyMini()}</div>
    <div><span class="eyebrow">ARTIST</span><h2 class="profile__name">이모티콘 작가 써니</h2>
    <p>일상의 작은 마음을 표정 하나에 담는 이모티콘 작가입니다. 작가 소개는 써니 작가가 직접 전해 줄 이야기로 곧 채워집니다.</p>
    <div class="link-row"><a class="btn btn--primary btn--sm" href="${askUrl}">작가에게 질문하기</a><a class="btn btn--ghost btn--sm" href="${pageUrl('collection')}">작품 보기</a></div></div>
  </div>
  <div id="iv-body"></div>`;
  const body = root.querySelector('#iv-body');
  if (!all.length) {
    body.innerHTML = `<section class="sub-section">
      <h2 class="h-section">첫 인터뷰를 준비하고 있어요</h2>
      <p class="muted-text">아래 질문으로 써니 작가와 이야기를 나눌 예정이에요. 답변은 작가가 직접 전한 내용으로만 게재합니다.</p>
      <ol class="q-list">${qs.map(q => `<li class="card">${q}</li>`).join('')}</ol>
      <a class="btn btn--primary" href="${askUrl}">궁금한 질문 남기기</a></section>`;
    return;
  }
  const featured = all.find(a => a.featured) || all[0];
  const draw = () => {
    const rest = all.filter(a => a !== featured && (!type || a.type === type));
    body.innerHTML = `<section class="sub-section"><h2 class="sr-only">대표 기사</h2><ul>${articleCard(featured, true)}</ul></section>
      <section class="sub-section"><h2 class="h-section">모든 이야기</h2>
      <div class="chips" role="group" aria-label="기사 유형">${['', ...ER.ARTICLE_TYPES].map(t => `<button type="button" class="chip" data-t="${t}" aria-pressed="${t === type}">${t || '전체'}</button>`).join('')}</div>
      ${rest.length ? `<ul class="acard-grid">${rest.map(a => articleCard(a)).join('')}</ul>` : emptyState('이 유형의 기사가 아직 없어요', '')}</section>`;
  };
  body.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; type = b.dataset.t; setParams({ type }); draw(); });
  draw();
}

function pageInterview(root, ctx) {
  const all = ER.listArticles();
  const a = ER.getArticle(qp('id'));
  if (!a) { root.innerHTML = emptyState('기사를 찾을 수 없어요', '비공개 처리되었거나 없는 기사입니다.', `<a class="btn btn--primary btn--sm" href="${pageUrl('interviews')}">창작 노트로 돌아가기</a>`); return; }
  ctx.setTitle(a.title);
  document.getElementById('page-lead').textContent = a.summary;
  root.innerHTML = `
  <article class="card article article--read">
    <div class="article__meta"><span class="tag">${esc(a.type)}</span> ${esc(a.author)} · ${fmtDate(a.createdAt)}</div>
    ${a.intro ? `<p class="article__intro">${nl2br(a.intro)}</p>` : ''}
    ${a.qa.length ? `<dl class="qa">${a.qa.map(x => `<dt>Q. ${esc(x.q)}</dt><dd>${nl2br(x.a || '')}</dd>`).join('')}</dl>` : ''}
    ${a.body ? `<div class="prose">${nl2br(a.body)}</div>` : ''}
    <div class="article__actions"><a class="btn btn--ghost btn--sm" href="${pageUrl('interviews')}">목록으로</a>
      <a class="btn btn--primary btn--sm" href="${pageUrl('lounge', '&write=1&tag=' + encodeURIComponent('작가에게 질문'))}">작가에게 질문하기</a></div>
  </article>
  ${relatedBlock(a.workIds, a.productIds)}
  ${prevNext(all, all.indexOf(a), x => pageUrl('interview', '&id=' + x.id), '기사')}`;
}

/* ---------- 커뮤니티 ---------- */
function pageLounge(root) {
  const user = ER.currentUser();
  const works = ER.listWorks().filter(w => w.status !== 'hidden');
  let tag = qp('tag');
  let work = qp('work');
  const writing = qp('write') === '1';

  root.innerHTML = `
  <div class="lounge-top card">
    <p>욕설·도배·광고·무단 도용 글은 숨김 처리될 수 있어요. 배송·결제처럼 개인정보가 필요한 문의는 <a href="mailto:e_iiias@naver.com">이메일</a>로 보내 주세요.</p>
    ${user ? `<button type="button" class="btn btn--primary btn--sm" id="open-write">글쓰기</button>` : `<a class="btn btn--primary btn--sm" href="${loginUrl()}">로그인하고 글쓰기</a>`}
  </div>
  <form class="card write" id="write-form" hidden novalidate>
    <h2 class="h-card">새 글 쓰기</h2>
    <div class="write__row">
      <div class="field"><label for="w-tag">태그</label><select id="w-tag" required>${ER.POST_TAGS.map(t => `<option${t === tag ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label for="w-work">관련 작품 (선택)</label><select id="w-work"><option value="">선택 안 함</option>${works.map(w => `<option value="${w.id}"${w.id === work ? ' selected' : ''}>${esc(workTitle(w))}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="w-title">제목</label><input id="w-title" maxlength="60" required></div>
    <div class="field"><label for="w-body">내용</label><textarea id="w-body" rows="6" maxlength="2000" required></textarea></div>
    <p class="form-error" role="alert"></p>
    <div class="write__actions"><button type="button" class="btn btn--ghost btn--sm" id="cancel-write">취소</button><button class="btn btn--primary btn--sm">등록하기</button></div>
  </form>
  <div class="lounge-filters">
    <div class="chips" role="group" aria-label="태그 필터" id="lg-tags"></div>
    <div class="field field--inline"><label for="lg-work">작품</label><select id="lg-work"><option value="">전체 작품</option>${works.map(w => `<option value="${w.id}">${esc(workTitle(w))}</option>`).join('')}</select></div>
  </div>
  <p class="result-count" aria-live="polite"></p>
  <div id="lg-list"></div>`;

  const form = root.querySelector('#write-form');
  const openWrite = () => { form.hidden = false; form.querySelector('#w-title').focus(); };
  if (user) {
    root.querySelector('#open-write').addEventListener('click', openWrite);
    if (writing) openWrite();
  }
  root.querySelector('#cancel-write').addEventListener('click', () => { form.hidden = true; form.reset(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button:not([type])');
    btn.disabled = true;
    try {
      await ER.addPost(ER.currentUser(), { tag: form.querySelector('#w-tag').value, workId: form.querySelector('#w-work').value, title: form.querySelector('#w-title').value, body: form.querySelector('#w-body').value });
      form.reset(); form.hidden = true; form.querySelector('.form-error').textContent = ''; toast('글을 등록했어요.', 'ok'); setParams({ write: '' }); draw();
    } catch (err) { form.querySelector('.form-error').textContent = err.message; }
    btn.disabled = false;
  });

  const lgWork = root.querySelector('#lg-work');
  lgWork.value = work;
  lgWork.addEventListener('change', () => { work = lgWork.value; setParams({ work }); draw(); });
  root.querySelector('#lg-tags').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; tag = b.dataset.tag; setParams({ tag }); draw(); });

  function draw() {
    root.querySelector('#lg-tags').innerHTML = ['', ...ER.POST_TAGS].map(t => `<button type="button" class="chip" data-tag="${t}" aria-pressed="${t === tag}">${t || '전체'}</button>`).join('');
    const list = ER.listPosts().filter(p => (!tag || p.tag === tag) && (!work || p.workId === work));
    root.querySelector('.result-count').textContent = `글 ${list.length}개`;
    root.querySelector('#lg-list').innerHTML = list.length
      ? `<ul class="post-list">${list.map(p => postRow(p, works)).join('')}</ul>`
      : emptyState(tag || work ? '조건에 맞는 글이 없어요' : '첫 이야기를 남겨 주세요', tag || work ? '다른 태그나 작품을 선택해 보세요.' : '써니 작가와 팬들이 여러분의 이야기를 기다리고 있어요.');
  }
  draw();
}

function pagePost(root, ctx) {
  const p = ER.listPosts().find(x => x.id === qp('id'));
  if (!p) { root.innerHTML = emptyState('글을 찾을 수 없어요', '삭제되었거나 비공개 처리된 글입니다.', `<a class="btn btn--primary btn--sm" href="${pageUrl('lounge')}">팬 라운지로 돌아가기</a>`); return; }
  const user = ER.currentUser();
  const w = ER.getWork(p.workId);
  ctx.setTitle(p.title);
  document.getElementById('page-lead').textContent = '';
  root.innerHTML = `
  <article class="card article article--read">
    <div class="article__meta"><span class="tag">${esc(p.tag)}</span> ${p.isArtist ? '<span class="badge badge--coral">작가 써니</span>' : esc(p.author)} · ${fmtDateTime(p.createdAt)}${w ? ` · <a href="${pageUrl('work', '&id=' + w.id)}">${esc(workTitle(w))}</a>` : ''}</div>
    <div class="prose">${nl2br(p.body)}</div>
    <div class="article__actions">
      <a class="btn btn--ghost btn--sm" href="${pageUrl('lounge')}">목록으로</a>
      ${user && user.uid === p.authorUid ? '<button type="button" class="btn btn--ghost btn--sm" id="del-post">삭제</button>' : ''}
      ${user && user.uid !== p.authorUid ? '<button type="button" class="btn btn--ghost btn--sm" id="report-post">신고</button>' : ''}
    </div>
  </article>
  <section class="sub-section comments" aria-labelledby="cm-title">
    <h2 class="h-section" id="cm-title">댓글 <span id="cm-count"></span></h2>
    <div id="cm-list"><div class="skeleton skeleton--sm" aria-hidden="true"></div></div>
    ${user ? `<form class="card cm-form" id="cm-form" novalidate>
        <div class="field"><label for="cm-body">댓글 쓰기</label><textarea id="cm-body" rows="3" maxlength="500" required placeholder="따뜻한 한마디를 남겨 주세요."></textarea></div>
        <p class="form-error" role="alert"></p><div class="write__actions"><button class="btn btn--primary btn--sm">댓글 등록</button></div></form>`
      : `<p class="note note--soft">댓글은 로그인한 회원만 쓸 수 있어요. <a class="text-link" href="${loginUrl()}">로그인하기</a></p>`}
  </section>`;
  const del = root.querySelector('#del-post');
  if (del) del.addEventListener('click', async () => { if (!confirm('이 글을 삭제할까요?')) return; try { await ER.deleteOwnPost(ER.currentUser(), p.id); toast('삭제했어요.'); location.href = pageUrl('lounge'); } catch (e) { toast(e.message, 'err'); } });
  const rep = root.querySelector('#report-post');
  if (rep) rep.addEventListener('click', async () => { try { await ER.reportPost(ER.currentUser(), p.id); toast('신고가 접수되었어요. 운영자가 확인할게요.', 'ok'); } catch (e) { toast(e.message, 'err'); } });

  let comments = [];
  const listEl = root.querySelector('#cm-list');
  const drawComments = () => {
    root.querySelector('#cm-count').textContent = comments.length ? comments.length : '';
    listEl.innerHTML = comments.length ? `<ul class="cm-list">${comments.map(c => `<li class="cm">
        <div class="cm__meta">${c.isArtist ? '<span class="badge badge--coral">작가 써니</span>' : `<strong>${esc(c.author)}</strong>`} · ${fmtDateTime(c.createdAt)}
        ${user && user.uid === c.authorUid ? `<button type="button" class="linklike cm__del" data-cdel="${c.id}">삭제</button>` : ''}</div>
        <p>${nl2br(c.body)}</p></li>`).join('')}</ul>` : '<p class="muted-text">아직 댓글이 없어요. 첫 댓글을 남겨 보세요.</p>';
  };
  ER.listComments(p.id).then(list => { comments = list; drawComments(); })
    .catch(e => { listEl.innerHTML = `<p class="form-error">댓글을 불러오지 못했어요: ${esc(e.message)}</p>`; });
  listEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-cdel]'); if (!b || !confirm('이 댓글을 삭제할까요?')) return;
    const c = comments.find(x => x.id === b.dataset.cdel);
    try { await ER.deleteOwnComment(ER.currentUser(), p.id, c); comments = comments.filter(x => x !== c); drawComments(); toast('댓글을 삭제했어요.'); } catch (err) { toast(err.message, 'err'); }
  });
  const cf = root.querySelector('#cm-form');
  if (cf) cf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = cf.querySelector('button'), errEl = cf.querySelector('.form-error');
    btn.disabled = true; errEl.textContent = '';
    try { comments.push(await ER.addComment(ER.currentUser(), p.id, cf.querySelector('#cm-body').value)); cf.reset(); drawComments(); toast('댓글을 등록했어요.', 'ok'); }
    catch (err) { errEl.textContent = err.message; }
    btn.disabled = false;
  });
}

function newsListRow(n) {
  const ev = eventState(n);
  return `<li class="news-row"><a href="${pageUrl('news-detail', '&id=' + n.id)}">
    <span class="news-row__tags"><span class="tag">${ER.NEWS_TYPES[n.type] || '소식'}</span>${ev ? `<span class="badge badge--${ev.cls}">${ev.label}</span>` : ''}${n.important ? '<span class="badge badge--coral">중요</span>' : ''}</span>
    <span class="news-row__title">${esc(n.title)}</span>
    <span class="news-row__date">${ev ? `${fmtDate(n.startAt)} ~ ${fmtDate(n.endAt)}` : fmtDate(n.createdAt)}</span></a></li>`;
}

function pageNews(root) {
  let type = qp('type');
  root.innerHTML = `<div class="chips" role="group" aria-label="분류 필터" id="nw-tags"></div><p class="result-count" aria-live="polite" id="nw-count"></p><div id="nw-list"></div>`;
  const draw = () => {
    root.querySelector('#nw-tags').innerHTML = [['', '전체'], ...Object.entries(ER.NEWS_TYPES)].map(([k, v]) => `<button type="button" class="chip" data-type="${k}" aria-pressed="${k === type}">${v}</button>`).join('');
    const list = ER.listNews().filter(n => !type || n.type === type);
    root.querySelector('#nw-count').textContent = `소식 ${list.length}개`;
    root.querySelector('#nw-list').innerHTML = list.length
      ? `<ul class="news-list card news-list--page">${list.map(newsListRow).join('')}</ul>`
      : emptyState('이 분류의 소식이 아직 없어요', '새 소식이 생기면 이곳에 가장 먼저 올라와요.');
  };
  root.querySelector('#nw-tags').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; type = b.dataset.type; setParams({ type }); draw(); });
  draw();
}

function pageNewsDetail(root, ctx) {
  const all = ER.listNews();
  const n = all.find(x => x.id === qp('id'));
  if (!n) { root.innerHTML = emptyState('소식을 찾을 수 없어요', '', `<a class="btn btn--primary btn--sm" href="${pageUrl('news')}">소식 목록으로</a>`); return; }
  ctx.setTitle(n.title);
  const ev = eventState(n);
  const isEvent = n.type === 'event';
  root.innerHTML = `
  <article class="card article article--read">
    <div class="article__meta"><span class="tag">${ER.NEWS_TYPES[n.type] || '소식'}</span>${n.important ? ' <span class="badge badge--coral">중요</span>' : ''}${ev ? ` <span class="badge badge--${ev.cls}">${ev.label}</span>` : ''} · ${fmtDate(n.createdAt)}</div>
    ${n.changeNote ? `<p class="note note--warn" role="note"><strong>변경 안내</strong> ${nl2br(n.changeNote)}</p>` : ''}
    <div class="prose">${nl2br(n.body)}</div>
    ${isEvent ? `<section class="event-box" aria-label="이벤트 안내">
      <dl class="kv kv--left">
        <div><dt>진행 상태</dt><dd>${ev ? ev.label : '일정 확인 중'}</dd></div>
        <div><dt>기간</dt><dd>${n.startAt && n.endAt ? `${fmtDateTime(n.startAt)} ~ ${fmtDateTime(n.endAt)}` : '확정 후 안내'}</dd></div>
        ${n.target ? `<div><dt>참여 대상</dt><dd>${esc(n.target)}</dd></div>` : ''}
        ${n.how ? `<div><dt>참여 방법</dt><dd>${nl2br(n.how)}</dd></div>` : ''}
        ${n.resultInfo ? `<div><dt>결과 발표</dt><dd>${nl2br(n.resultInfo)}</dd></div>` : ''}
      </dl>
      ${ev && ev.key === 'live' && /^https?:\/\//.test(n.joinUrl) ? `<a class="btn btn--primary" href="${esc(n.joinUrl)}" target="_blank" rel="noopener noreferrer">이벤트 참여하기<span class="sr-only"> (새 창)</span></a>`
        : `<button type="button" class="btn btn--primary" disabled>${ev && ev.key === 'ended' ? '종료된 이벤트예요' : ev && ev.key === 'soon' ? '아직 시작 전이에요' : '참여 방법 안내 예정'}</button>`}
      <p class="muted-text">참여에 필요한 개인정보는 비공개 양식으로만 받아요. 공개 댓글에 연락처를 남기지 마세요.</p>
    </section>` : ''}
    <div class="article__actions"><a class="btn btn--ghost btn--sm" href="${pageUrl('news')}">목록으로</a></div>
  </article>
  ${relatedBlock(n.workIds, n.productIds)}
  ${prevNext(all, all.indexOf(n), x => pageUrl('news-detail', '&id=' + x.id), '소식')}`;
}

/* ---------- 보조 페이지 ---------- */
function pageSearch(root) {
  const q = qp('q').trim();
  root.innerHTML = `<form class="search-big" action="page.html" role="search"><input type="hidden" name="p" value="search">
    <label class="sr-only" for="sq">검색어</label><input id="sq" name="q" type="search" value="${esc(q)}" placeholder="작품, 굿즈, 소식 검색"><button class="btn btn--primary">검색</button></form><div id="sr"></div>`;
  if (!q) { root.querySelector('#sr').innerHTML = emptyState('검색어를 입력해 주세요', '작품명, 굿즈, 소식, 팬 라운지 글을 한 번에 찾을 수 있어요.'); return; }
  const lq = q.toLowerCase();
  const has = (...t) => t.join(' ').toLowerCase().includes(lq);
  const works = ER.listWorks().filter(w => w.status !== 'hidden' && has(w.name, w.concept));
  const prods = ER.listProducts().filter(p => has(p.name, p.summary, p.description, p.workIds.map(id => ER.getWork(id)).filter(Boolean).map(workTitle).join(' ')));
  const arts = ER.listArticles().filter(a => has(a.title, a.summary, a.body));
  const news = ER.listNews().filter(n => has(n.title, n.body));
  const posts = ER.listPosts().filter(p => has(p.title, p.body));
  const total = works.length + prods.length + arts.length + news.length + posts.length;
  root.querySelector('#sr').innerHTML = `<p class="result-count">‘${esc(q)}’ 검색 결과 ${total}개</p>` + (total ? `
    ${works.length ? `<section class="sub-section"><h2 class="h-section">작품 ${works.length}</h2><ul class="work-grid">${works.map(w => workCard(w)).join('')}</ul></section>` : ''}
    ${prods.length ? `<section class="sub-section"><h2 class="h-section">굿즈 ${prods.length}</h2>${productGrid(prods)}</section>` : ''}
    ${arts.length ? `<section class="sub-section"><h2 class="h-section">매거진 ${arts.length}</h2><ul class="acard-grid">${arts.map(a => articleCard(a)).join('')}</ul></section>` : ''}
    ${news.length ? `<section class="sub-section"><h2 class="h-section">소식·이벤트 ${news.length}</h2><ul class="news-list card news-list--page">${news.map(newsListRow).join('')}</ul></section>` : ''}
    ${posts.length ? `<section class="sub-section"><h2 class="h-section">팬 라운지 ${posts.length}</h2><ul class="post-list">${posts.map(p => postRow(p, ER.listWorks())).join('')}</ul></section>` : ''}`
    : emptyState('검색 결과가 없습니다', '다른 키워드로 찾아보세요.', `<a class="btn btn--ghost btn--sm" href="${pageUrl('collection')}">작품 둘러보기</a>`));
}

function pageMypage(root) {
  const user = ER.currentUser();
  if (!user) { location.href = 'login.html?next=' + encodeURIComponent('page.html?p=mypage'); return; }
  const mine = ER.listPosts().filter(p => p.authorUid === user.uid);
  const wish = store.get(WISH_KEY).map(id => ER.getProduct(id)).filter(Boolean);
  const cartN = store.get(CART_KEY).length;
  const nav = [['my-info', '회원 정보'], ['my-orders', '주문·배송'], ['my-digital', '디지털 구매'], ['my-wish', '찜한 상품'], ['my-posts', '내가 쓴 글'], ['my-help', '문의·고객지원']];
  root.innerHTML = `
  <nav class="my-nav" aria-label="마이페이지 메뉴">${nav.map(([id, l]) => `<a href="#${id}">${l}</a>`).join('')}</nav>
  <div class="my-grid">
    <section class="card" id="my-info"><h2 class="h-card">회원 정보</h2>
      <dl class="kv"><div><dt>닉네임</dt><dd>${esc(user.nickname)}</dd></div><div><dt>이메일</dt><dd>${esc(user.email)}</dd></div>
      <div><dt>가입일</dt><dd>${fmtDate(user.createdAt)}</dd></div><div><dt>회원 유형</dt><dd>${ER.ROLES[user.role]}${user.isArtist ? ' · <span class="badge badge--coral">작가 써니</span>' : ''}</dd></div>
      <div><dt>마케팅 수신</dt><dd>${user.marketing ? '동의' : '미동의'}</dd></div></dl>
      <p class="muted-text my-note">비밀번호 변경·회원 탈퇴는 고객 문의로 요청해 주세요.</p></section>
    <section class="card" id="my-orders"><h2 class="h-card">주문·배송</h2>${emptyState('주문 내역이 없어요', '굿즈샵 오픈 후 주문·배송 내역을 확인할 수 있어요.', cartN ? `<a class="btn btn--ghost btn--sm" href="${pageUrl('cart')}">장바구니 ${cartN}건 보기</a>` : '')}</section>
    <section class="card" id="my-digital"><h2 class="h-card">디지털 구매 내역</h2>${emptyState('받을 수 있는 디지털 상품이 없어요', '결제 완료가 확인된 디지털 상품만 이곳에서 내려받을 수 있어요.')}</section>
    <section class="card" id="my-wish"><h2 class="h-card">찜한 상품</h2>${wish.length ? `<ul class="mini-list">${wish.map(p => `<li><a href="${pageUrl('product', '&id=' + p.id)}">${esc(p.name)}</a><span>${won(p.price)}</span></li>`).join('')}</ul>` : emptyState('찜한 상품이 없어요', '', `<a class="btn btn--ghost btn--sm" href="${pageUrl('goods-all')}">굿즈 둘러보기</a>`)}</section>
  </div>
  <section class="sub-section" id="my-posts"><h2 class="h-section">내가 쓴 글</h2>
    ${mine.length ? `<ul class="post-list">${mine.map(p => postRow(p, ER.listWorks())).join('')}</ul>` : emptyState('아직 쓴 글이 없어요', '', `<a class="btn btn--primary btn--sm" href="${pageUrl('lounge', '&write=1')}">팬 라운지에 글쓰기</a>`)}</section>
  <section class="sub-section" id="my-help"><h2 class="h-section">상품 문의·고객지원</h2>
    <div class="card help-row"><p>주문·배송·결제 문의는 개인정보 보호를 위해 비공개로 받아요.</p><div class="link-row"><a class="btn btn--primary btn--sm" href="mailto:e_iiias@naver.com">이메일 문의</a><a class="btn btn--ghost btn--sm" href="${pageUrl('support')}">고객지원 안내</a></div></div></section>`;
}

function pageSupport(root) {
  root.innerHTML = `
  <div class="support-grid">
    <a class="card support-card" href="tel:01026273771"><span class="support-card__ic" aria-hidden="true">☎</span><strong>전화 문의</strong><span>010-2627-3771</span></a>
    <a class="card support-card" href="mailto:e_iiias@naver.com"><span class="support-card__ic" aria-hidden="true">✉</span><strong>이메일 문의</strong><span>e_iiias@naver.com</span></a>
    <a class="card support-card" href="${pageUrl('mypage')}"><span class="support-card__ic" aria-hidden="true">☺</span><strong>주문 확인</strong><span>마이페이지에서 주문·배송 확인</span></a>
  </div>
  <section class="sub-section"><h2 class="h-section">배송·교환·반품 안내</h2>
    <div class="card prose"><p><strong>[운영 정보 입력]</strong> 배송비, 출고 일정, 교환·반품 기준과 절차는 굿즈샵 운영 정책이 확정되면 이곳에 게시됩니다.</p>
    <p>주문제작 상품과 디지털 상품은 일반 상품과 기준이 다를 수 있으며, 상품 상세에 별도로 안내합니다.</p></div></section>
  <section class="sub-section"><h2 class="h-section">문의 전에 확인해 주세요</h2>
    <ul class="check-list card">
      <li>주문번호, 받는 분 정보처럼 개인정보가 담긴 내용은 팬 라운지가 아닌 이메일로 보내 주세요.</li>
      <li>작품·굿즈에 대한 질문은 팬 라운지의 ‘작가에게 질문’ 태그로도 남길 수 있어요.</li>
      <li>협업·제휴 문의는 이메일 제목에 [협업]을 붙여 주시면 빠르게 확인할게요.</li>
    </ul></section>
  <section class="sub-section"><h2 class="h-section">정책 문서</h2>
    <div class="link-row"><a class="btn btn--ghost btn--sm" href="${pageUrl('policy', '&doc=terms')}">이용약관</a><a class="btn btn--ghost btn--sm" href="${pageUrl('policy', '&doc=privacy')}">개인정보처리방침</a></div></section>`;
}

function pagePolicy(root, ctx) {
  const doc = qp('doc');
  const titles = { shipping: '배송·교환·반품 안내', terms: '이용약관', privacy: '개인정보처리방침' };
  ctx.setTitle(titles[doc] || '안내');
  root.innerHTML = `<div class="card prose"><p><strong>[운영 정보 입력]</strong> 이 문서는 실제 운영 정책이 확정된 뒤 게시됩니다.</p>
    <p>그 전까지 궁금한 점은 전화 <a href="tel:01026273771">010-2627-3771</a> 또는 이메일 <a href="mailto:e_iiias@naver.com">e_iiias@naver.com</a>으로 문의해 주세요.</p></div>
    <div class="link-row link-row--top"><a class="btn btn--ghost btn--sm" href="${pageUrl('support')}">고객지원으로</a></div>`;
}

window.sunnyMini = sunnyMini;
function sunnyMini() {
  return `<svg viewBox="0 0 120 120"><g stroke="#FFB648" stroke-width="7" stroke-linecap="round">${Array.from({ length: 10 }, (_, i) => { const a = i * 36 * Math.PI / 180; return `<line x1="${60 + Math.cos(a) * 44}" y1="${60 + Math.sin(a) * 44}" x2="${60 + Math.cos(a) * 54}" y2="${60 + Math.sin(a) * 54}"/>`; }).join('')}</g>
    <circle cx="60" cy="60" r="36" fill="#FFD66B" stroke="#3A2E28" stroke-width="3"/><ellipse cx="48" cy="56" rx="4" ry="5.4" fill="#3A2E28"/><ellipse cx="72" cy="56" rx="4" ry="5.4" fill="#3A2E28"/>
    <ellipse cx="40" cy="68" rx="6" ry="3.6" fill="#F46B78" opacity=".55"/><ellipse cx="80" cy="68" rx="6" ry="3.6" fill="#F46B78" opacity=".55"/><path d="M51 70q9 9 18 0" stroke="#3A2E28" stroke-width="3.4" fill="none" stroke-linecap="round"/></svg>`;
}

/* ---------- 시작 ---------- */
// main.js는 store.js(Firebase SDK)보다 먼저 실행된다. 헤더·푸터는 즉시 그리고, 로그인 상태는 준비되면 다시 반영한다.
renderHeader();
renderFooter();
const erLoaded = new Promise(resolve => {
  if (window.ER) resolve();
  else window.addEventListener('er:loaded', resolve, { once: true });
});
const slowTimer = setTimeout(() => showLoadError('서버 응답이 늦어지고 있어요. 네트워크를 확인한 뒤 새로고침해 주세요.'), 15000);
function showLoadError(msg) {
  if (document.querySelector('.load-error')) return;
  const bar = document.createElement('p');
  bar.className = 'load-error'; bar.setAttribute('role', 'alert');
  bar.textContent = msg;
  document.getElementById('main').prepend(bar);
}
erLoaded.then(() => ER.ready).then(() => {
  clearTimeout(slowTimer);
  document.querySelector('.load-error')?.remove();
  renderHeader();
  const page = document.body.dataset.page;
  if (page === 'home') renderHome();
  if (page === 'sub') renderSubPage();
  if (ER.loadError) showLoadError('일부 정보를 불러오지 못했어요: ' + ER.loadError.message + ' 잠시 후 새로고침해 주세요.');
});

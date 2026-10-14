/* EmoRing 관리자 대시보드
 * 모든 변경은 store.js의 권한 검사(ER.can)를 다시 거치며, 매 작업마다 현재 사용자를 새로 읽어
 * 권한 회수·계정 비활성화가 즉시 반영된다. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const SECTIONS = [
    { id: 'dashboard', label: '대시보드', icon: '◎', perm: 'admin.access' },
    { id: 'members', label: '회원', icon: '☺', perm: 'members.view' },
    { id: 'content', label: '작품·소식', icon: '✦', perm: 'content.view' },
    { id: 'community', label: '커뮤니티', icon: '✎', perm: 'community.edit' },
    { id: 'orders', label: '주문·매출', icon: '₩', perm: 'orders.view' },
    { id: 'service', label: '서비스', icon: '♡', perm: 'admin.access' },
    { id: 'audit', label: '감사 로그', icon: '☰', perm: 'audit.view' },
    { id: 'settings', label: '설정', icon: '⚙', perm: 'admin.access' }
  ];
  const C = { pay: '#0057B8', refund: '#E8606E' }; // 검증된 2색 조합(dataviz validator 통과)
  let me = null;
  let days = 30;
  const view = $('#adm-view');
  const state = { members: { q: '', page: 1 }, orders: { status: '', page: 1 }, community: { reported: false }, audit: { q: '' } };

  /* ---------- 권한 게이트 ---------- */
  function refreshMe() {
    me = ER.currentUser();
    if (!me) { location.replace('login.html?next=admin.html'); return false; }
    if (!ER.can(me, 'admin.access')) { showDenied(); return false; }
    return true;
  }
  function showDenied() {
    $('#adm').hidden = true;
    const g = $('#gate'); g.hidden = false;
    g.innerHTML = `<div class="gate__card"><img src="images/logo.png" alt="EmoRing" class="gate__logo">
      <h1 class="gate__title">관리자 권한이 없는 계정입니다</h1>
      <p>관리자 페이지는 권한이 부여된 계정만 이용할 수 있어요.</p>
      <div class="gate__actions"><a class="btn btn--primary btn--sm" href="index.html">홈으로</a><button type="button" class="btn btn--ghost btn--sm" id="gate-logout">다른 계정으로 로그인</button></div></div>`;
    $('#gate-logout').addEventListener('click', async () => { await ER.logout(); location.href = 'login.html?next=admin.html'; });
  }

  /* ---------- 날짜·집계 ---------- */
  const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' });
  const dayKey = (d) => keyFmt.format(new Date(d));
  const DAY = 86400000;
  const periodKeys = (n, offset = 0) => Array.from({ length: n }, (_, i) => dayKey(Date.now() - (n - 1 - i + offset) * DAY));
  function delta(cur, prev, unit = '') {
    if (!prev) return `<span class="kpi__delta">이전 기간 대비 <b>비교 불가</b></span>`;
    const pct = Math.round((cur - prev) / Math.abs(prev) * 100);
    const sign = pct > 0 ? '▲' : pct < 0 ? '▼' : '–';
    return `<span class="kpi__delta">이전 ${days}일 대비 <b>${sign} ${Math.abs(pct)}%</b>${unit}</span>`;
  }
  const maskEmail = (e) => { const [id, dom] = e.split('@'); return id.slice(0, 2) + '***@' + dom; };
  const can = (p) => ER.can(me, p);
  const noPerm = (what) => `<div class="adm-empty"><strong>권한 없음</strong><p>${what}은(는) 현재 역할(${ER.ROLES[me.role]})로 볼 수 없습니다.</p></div>`;

  function orderStats(orders, keys) {
    const set = new Set(keys);
    const byDay = Object.fromEntries(keys.map(k => [k, { pay: 0, refund: 0, n: 0 }]));
    let pay = 0, refund = 0, n = 0;
    for (const o of orders) {
      const k = dayKey(o.paidAt);
      if (!set.has(k)) continue;
      byDay[k].pay += o.amountMinor; byDay[k].refund += o.refundMinor; byDay[k].n++;
      pay += o.amountMinor; refund += o.refundMinor; n++;
    }
    return { pay, refund, net: pay - refund, n, byDay };
  }

  /* ---------- 레이아웃 ---------- */
  function renderShell() {
    $('#gate').hidden = true;
    $('#adm').hidden = false;
    $('#adm-nav').innerHTML = SECTIONS.map(s => `<li><a href="#${s.id}" data-sec="${s.id}"${can(s.perm) ? '' : ' class="is-locked"'}><span class="adm-nav__icon" aria-hidden="true">${s.icon}</span>${s.label}${can(s.perm) ? '' : '<span class="sr-only"> (권한 없음)</span><span class="adm-nav__lock" aria-hidden="true">🔒</span>'}</a></li>`).join('');
    $('#adm-user').innerHTML = `<span class="adm-user__avatar" aria-hidden="true">${esc(me.nickname.slice(0, 1))}</span>
      <span class="adm-user__meta"><strong>${esc(me.nickname)}</strong><small>${ER.ROLES[me.role]}</small></span>
      <button type="button" class="btn btn--ghost btn--sm" id="adm-logout">로그아웃</button>`;
    $('#adm-logout').addEventListener('click', async () => { await ER.logout(); location.href = 'login.html'; });
  }

  // reload=true일 때만 Firestore에서 다시 읽는다(검색·페이지 이동은 캐시로 다시 그림)
  let loading = false;
  async function route(reload = false) {
    if (!refreshMe()) return;
    if (reload || !ER.health()) {
      if (loading) return;
      loading = true;
      view.innerHTML = '<div class="skeleton" aria-hidden="true"></div>';
      try { await ER.loadAdmin(); }
      catch (e) {
        loading = false;
        view.innerHTML = `<div class="adm-empty adm-empty--err"><strong>데이터를 불러오지 못했어요</strong><p>${esc(e.message)}</p><p>Firestore 보안 규칙 배포와 관리자 역할(adminAccess) 설정을 확인해 주세요.</p><button type="button" class="btn btn--ghost btn--sm" id="retry">다시 시도</button></div>`;
        $('#retry').addEventListener('click', () => route(true));
        return;
      }
      loading = false;
    }
    const id = (location.hash || '#dashboard').slice(1);
    const sec = SECTIONS.find(s => s.id === id) || SECTIONS[0];
    document.querySelectorAll('#adm-nav a').forEach(a => { if (a.dataset.sec === sec.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#adm-title').textContent = sec.label;
    document.title = `${sec.label} | EmoRing 관리자`;
    closeSide();
    if (!can(sec.perm)) { view.innerHTML = noPerm(sec.label); stamp(); return; }
    try { RENDER[sec.id](); } catch (e) { view.innerHTML = `<div class="adm-empty adm-empty--err"><strong>화면을 불러오지 못했어요</strong><p>${esc(e.message)}</p><button type="button" class="btn btn--ghost btn--sm" onclick="location.reload()">다시 시도</button></div>`; }
    stamp();
  }
  function stamp() { $('#updated').textContent = '갱신 ' + fmtDateTime(new Date().toISOString()).slice(11); }

  // 모바일 사이드바
  const side = $('#adm-side'), sideBg = $('#adm-side-bg'), menuBtn = $('#adm-menu');
  function closeSide() { side.classList.remove('is-open'); sideBg.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.addEventListener('click', () => { side.classList.add('is-open'); sideBg.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); side.querySelector('a').focus(); });
  sideBg.addEventListener('click', closeSide);
  side.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSide(); menuBtn.focus(); } });

  $('#period').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    days = +b.dataset.days;
    document.querySelectorAll('#period button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    route();
  });
  $('#refresh').addEventListener('click', () => route(true));
  window.addEventListener('hashchange', () => route(true));
  // 폭이 바뀔 때만 차트를 다시 그린다(모바일 스크롤 중 높이 변화는 무시)
  let rT, lastW = window.innerWidth;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; if ((location.hash || '#dashboard') === '#dashboard') route(); }, 200); });
  view.addEventListener('click', (e) => { onMemberAction(e); onContentAction(e); onCommunityAction(e); });

  /* ---------- 모달 ---------- */
  const dlg = $('#modal');
  let lastFocus = null;
  function openModal({ title, body, ok = '저장', danger = false, onSubmit }) {
    lastFocus = document.activeElement;
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;
    $('#modal-error').textContent = '';
    const okBtn = $('#modal-ok');
    okBtn.textContent = ok;
    okBtn.className = 'btn btn--sm ' + (danger ? 'btn--danger' : 'btn--primary');
    $('#modal-form').onsubmit = async (e) => {
      e.preventDefault();
      if (!refreshMe()) { dlg.close(); return; }
      okBtn.disabled = true;
      try { await onSubmit($('#modal-form').elements); dlg.close(); route(); }
      catch (err) { $('#modal-error').textContent = err.message; }
      okBtn.disabled = false;
    };
    dlg.showModal();
    const first = $('#modal-body').querySelector('input,select,textarea');
    (first || okBtn).focus();
  }
  dlg.addEventListener('close', () => { if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); });
  dlg.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', () => dlg.close()));

  function pager(total, page, size, onGo) {
    const pages = Math.max(1, Math.ceil(total / size));
    const wrap = document.createElement('nav');
    wrap.className = 'pager'; wrap.setAttribute('aria-label', '페이지 이동');
    wrap.innerHTML = `<button type="button" class="btn btn--ghost btn--sm" data-go="${page - 1}" ${page <= 1 ? 'disabled' : ''}>이전</button>
      <span>${page} / ${pages}</span>
      <button type="button" class="btn btn--ghost btn--sm" data-go="${page + 1}" ${page >= pages ? 'disabled' : ''}>다음</button>`;
    wrap.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b && !b.disabled) onGo(+b.dataset.go); });
    return wrap;
  }

  /* ---------- 차트 ---------- */
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  const shortWon = (v) => v >= 10000 ? (v / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '만' : v.toLocaleString('ko-KR');

  function lineChart(host, keys, series) {
    const W = Math.max(320, host.clientWidth), H = 260, P = { l: 52, r: 56, t: 16, b: 30 };
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const max = niceMax(Math.max(...series.flatMap(s => s.values)));
    const x = (i) => P.l + (keys.length === 1 ? iw / 2 : i * iw / (keys.length - 1));
    const y = (v) => P.t + ih - v / max * ih;
    const ticks = [0, .25, .5, .75, 1].map(t => t * max);
    const step = Math.ceil(keys.length / (W < 560 ? 4 : 7));
    const xl = keys.map((k, i) => (i % step === 0 || i === keys.length - 1) && !(i !== keys.length - 1 && keys.length - 1 - i < step / 2) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${k.slice(5).replace('-', '.')}</text>` : '').join('');
    const last = keys.length - 1;
    // 끝점 직접 라벨: 겹치면 아래쪽 라벨을 내린다
    const ends = series.map(s => ({ s, y: y(s.values[last]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16;

    host.innerHTML = `<div class="chart">
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${series.map(s => s.name).join('·')} 일별 추이. 방향키로 날짜별 값을 확인할 수 있습니다." tabindex="0">
        <g class="chart__grid">${ticks.map(t => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
        <g class="chart__axis">${ticks.map(t => `<text x="${P.l - 8}" y="${y(t) + 4}" text-anchor="end">${shortWon(t)}</text>`).join('')}${xl}</g>
        ${series.map(s => `<path d="${s.values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
        ${ends.map(e => `<circle cx="${x(last)}" cy="${y(e.s.values[last])}" r="4" fill="${e.s.color}" stroke="#fff" stroke-width="2"/><text class="chart__end" x="${x(last) + 8}" y="${e.y + 4}">${e.s.name}</text>`).join('')}
        <g class="chart__hover" visibility="hidden"><line class="chart__cross" y1="${P.t}" y2="${P.t + ih}"/>${series.map(s => `<circle r="5" fill="${s.color}" stroke="#fff" stroke-width="2"/>`).join('')}</g>
        <rect class="chart__hit" x="${P.l}" y="${P.t}" width="${iw}" height="${ih}" fill="transparent"/>
      </svg>
      <div class="chart__tip" hidden></div></div>`;

    const svg = host.querySelector('svg'), hover = svg.querySelector('.chart__hover'), tip = host.querySelector('.chart__tip');
    let cur = -1;
    const show = (i) => {
      cur = Math.max(0, Math.min(last, i));
      hover.setAttribute('visibility', 'visible');
      const cx = x(cur);
      const cross = hover.querySelector('line'); cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
      hover.querySelectorAll('circle').forEach((c, j) => { c.setAttribute('cx', cx); c.setAttribute('cy', y(series[j].values[cur])); });
      tip.hidden = false;
      tip.innerHTML = `<strong>${keys[cur].replace(/-/g, '.')}</strong>` + series.map(s => `<span><i style="background:${s.color}"></i>${s.name}<b>${fmtWon(s.values[cur])}</b></span>`).join('');
      const scale = svg.getBoundingClientRect().width / W;
      const left = cx * scale;
      tip.style.left = Math.min(Math.max(left, 80), svg.getBoundingClientRect().width - 80) + 'px';
    };
    const hide = () => { hover.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * W;
      if (px < P.l - 10 || px > W - P.r + 10) return hide();
      show(Math.round((px - P.l) / (iw / Math.max(1, last))));
    });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(cur < 0 ? 0 : cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur < 0 ? last : cur - 1); }
      if (e.key === 'Escape') hide();
    });
  }

  function barList(rows) {
    const max = Math.max(1, ...rows.map(r => r.value));
    return `<ul class="bars">${rows.map(r => `<li><span class="bars__label">${r.label}</span>
      <span class="bars__track"><span class="bars__fill" style="width:${r.value ? Math.max(2, r.value / max * 100) : 0}%"></span></span>
      <span class="bars__val">${r.value}</span></li>`).join('')}</ul>`;
  }

  /* ---------- 섹션 렌더러 ---------- */
  const RENDER = {
    dashboard() {
      const keys = periodKeys(days), prevKeys = periodKeys(days, days);
      const kset = new Set(keys), pset = new Set(prevKeys);
      const users = ER.listUsers();
      const newU = users.filter(u => kset.has(dayKey(u.createdAt))).length;
      const prevU = users.filter(u => pset.has(dayKey(u.createdAt))).length;
      const works = ER.listWorks();
      const reviewWorks = works.filter(w => w.status === 'review');
      const reported = ER.listPosts({ includeHidden: true }).filter(p => p.status === 'published' && p.reports > 0);
      const canOrders = can('orders.view');
      const orders = canOrders ? ER.listOrders(me) : [];
      const st = orderStats(orders, keys), prevSt = orderStats(orders, prevKeys);
      const health = ER.health();

      view.innerHTML = `
      <section class="kpis" aria-label="핵심 지표">
        <article class="kpi"><h2 class="kpi__label">전체 회원</h2><p class="kpi__value">${users.length.toLocaleString()}<small>명</small></p><span class="kpi__delta">관리자 계정 포함 · 브라우저 저장소 기준</span></article>
        <article class="kpi"><h2 class="kpi__label">기간 내 신규 회원</h2><p class="kpi__value">${newU.toLocaleString()}<small>명</small></p>${delta(newU, prevU)}</article>
        <article class="kpi"><h2 class="kpi__label">처리 대기</h2><p class="kpi__value">${reviewWorks.length + reported.length}<small>건</small></p><span class="kpi__delta">검토 중 작품 ${reviewWorks.length} · 신고된 글 ${reported.length}</span></article>
        <article class="kpi kpi--demo">${canOrders
          ? `<h2 class="kpi__label">기간 순매출 <span class="badge badge--warn">데모</span></h2><p class="kpi__value">${shortWon(st.net)}<small>원</small></p>${delta(st.net, prevSt.net)}`
          : `<h2 class="kpi__label">기간 순매출</h2><p class="kpi__value kpi__value--na">권한 없음</p><span class="kpi__delta">재무·최고 관리자만 조회</span>`}</article>
      </section>

      <div class="adm-grid">
        <section class="panel panel--wide">
          <div class="panel__head"><h2 class="panel__title">일별 결제·환불 <span class="badge badge--warn">데모</span></h2>
            ${canOrders ? `<ul class="legend"><li><i style="background:${C.pay}"></i>결제액</li><li><i style="background:${C.refund}"></i>환불액</li></ul>` : ''}</div>
          ${canOrders ? `<div id="chart-pay"></div>
            <p class="panel__note">순매출 표시값 = 기간 결제액 ${fmtWon(st.pay)} − 기간 환불액 ${fmtWon(st.refund)}. 회계상 매출·정산액과 다릅니다. 기준: Asia/Seoul 날짜.</p>
            <details class="tableview"><summary>표로 보기</summary><div class="table-wrap"><table><thead><tr><th scope="col">날짜</th><th scope="col">주문 수</th><th scope="col">결제액</th><th scope="col">환불액</th></tr></thead>
            <tbody>${keys.slice().reverse().map(k => `<tr><td>${k}</td><td>${st.byDay[k].n}</td><td>${fmtWon(st.byDay[k].pay)}</td><td>${fmtWon(st.byDay[k].refund)}</td></tr>`).join('')}</tbody></table></div></details>`
          : noPerm('매출 차트')}
        </section>

        <section class="panel">
          <div class="panel__head"><h2 class="panel__title">작품 상태 분포</h2><a class="more" href="#content">관리</a></div>
          ${barList(Object.entries(ER.WORK_STATUS).map(([k, v]) => ({ label: v, value: works.filter(w => w.status === k).length })))}
          <p class="panel__note">승인작 8종 기준</p>
        </section>

        <section class="panel">
          <div class="panel__head"><h2 class="panel__title">처리 대기 목록</h2></div>
          ${reviewWorks.length + reported.length ? `<ul class="todo">
            ${reviewWorks.map(w => `<li><span class="badge badge--blue">작품 검토</span><a href="#content">작품 ${String(w.no).padStart(2, '0')} ${esc(w.name)}</a></li>`).join('')}
            ${reported.map(p => `<li><span class="badge badge--err">신고 ${p.reports}</span><a href="#community">${esc(p.title)}</a></li>`).join('')}</ul>`
          : `<div class="adm-empty adm-empty--sm"><strong>처리할 항목이 없어요</strong><p>검토 중 작품과 신고된 글이 여기에 표시됩니다.</p></div>`}
        </section>

        <section class="panel">
          <div class="panel__head"><h2 class="panel__title">최근 활동</h2>${can('audit.view') ? '<a class="more" href="#audit">전체</a>' : ''}</div>
          ${can('audit.view') ? `<ul class="activity">${ER.listAudit(me).slice(0, 6).map(a => `<li><span class="activity__dot${a.outcome !== '성공' ? ' is-fail' : ''}" aria-hidden="true"></span><div><strong>${esc(a.action)}</strong>${a.outcome !== '성공' ? ' <span class="badge badge--err">' + esc(a.outcome) + '</span>' : ''}<small>${esc(a.actor)} · ${fmtDateTime(a.at)}</small></div></li>`).join('')}</ul>` : noPerm('감사 기록')}
        </section>

        <section class="panel panel--wide">
          <div class="panel__head"><h2 class="panel__title">최근 주문 <span class="badge badge--warn">데모</span></h2>${canOrders ? '<a class="more" href="#orders">전체</a>' : ''}</div>
          ${canOrders ? ordersTable(orders.slice().sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 5)) : noPerm('주문')}
        </section>

        <section class="panel">
          <div class="panel__head"><h2 class="panel__title">서비스 상태</h2><a class="more" href="#service">상세</a></div>
          <ul class="health">
            <li>${healthBadge(health.ok ? 'ok' : 'err')}<span>Firebase 인증·Firestore</span><small>응답 ${health.latencyMs}ms · ${fmtDateTime(health.checkedAt)} 측정</small></li>
            <li>${healthBadge('na')}<span>Cloud Functions</span><small>연결 전</small></li>
            <li>${healthBadge('na')}<span>결제 웹훅</span><small>연결 전</small></li>
          </ul>
        </section>
      </div>`;
      if (canOrders) lineChart($('#chart-pay'), keys, [
        { name: '결제액', color: C.pay, values: keys.map(k => st.byDay[k].pay) },
        { name: '환불액', color: C.refund, values: keys.map(k => st.byDay[k].refund) }
      ]);
    },

    members() {
      const s = state.members;
      const all = ER.listUsers().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const q = s.q.trim().toLowerCase();
      const list = q ? all.filter(u => (u.email + ' ' + u.nickname + ' ' + u.name).toLowerCase().includes(q)) : all;
      const size = 10; const page = Math.min(s.page, Math.max(1, Math.ceil(list.length / size)));
      const rows = list.slice((page - 1) * size, page * size);
      view.innerHTML = `
      <section class="panel">
        <div class="toolbar">
          <label class="sr-only" for="m-q">회원 검색</label>
          <input id="m-q" class="input" type="search" placeholder="닉네임, 이메일, 이름 검색" value="${esc(s.q)}">
          <span class="toolbar__count">총 ${list.length}명</span>
        </div>
        ${rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th scope="col">닉네임</th><th scope="col">이메일</th><th scope="col">가입일</th><th scope="col">역할</th><th scope="col">상태</th><th scope="col"><span class="sr-only">작업</span></th></tr></thead><tbody>
          ${rows.map(u => `<tr>
            <td><strong>${esc(u.nickname)}</strong>${u.uid === me.uid ? ' <span class="badge badge--blue">나</span>' : ''}</td>
            <td>${esc(maskEmail(u.email))}</td>
            <td>${fmtDate(u.createdAt)}</td>
            <td>${ER.ROLES[u.role]}</td>
            <td>${u.status === 'active' ? '<span class="badge badge--ok">● 활성</span>' : '<span class="badge badge--err">■ 비활성</span>'}</td>
            <td class="tbl__actions">${u.uid === me.uid ? '' : `
              ${can('members.status') ? `<button type="button" class="btn btn--ghost btn--xs" data-status="${u.uid}">${u.status === 'active' ? '비활성화' : '활성화'}</button>` : ''}`}</td></tr>`).join('')}
        </tbody></table></div>` : `<div class="adm-empty"><strong>검색 결과가 없습니다</strong><p>다른 키워드로 찾아보세요.</p></div>`}
        <p class="panel__note">이메일은 기본 마스킹됩니다. 계정 상태 변경은 사유와 함께 감사 로그에 기록됩니다. 관리자 역할 부여·회수는 서버 스크립트(scripts/set-admin.mjs)로만 할 수 있습니다.</p>
      </section>`;
      const qi = $('#m-q');
      let t; qi.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { s.q = qi.value; s.page = 1; route(); $('#m-q').focus(); const v = $('#m-q'); v.setSelectionRange(v.value.length, v.value.length); }, 250); });
      view.querySelector('.panel').appendChild(pager(list.length, page, size, p => { s.page = p; route(); }));
    },

    content() {
      const works = ER.listWorks();
      const news = ER.listNews({ includeHidden: true });
      const edit = can('content.edit');
      view.innerHTML = `
      <section class="panel">
        <div class="panel__head"><h2 class="panel__title">승인작 8종</h2></div>
        <p class="panel__note panel__note--top">실제 작품 자료가 확인된 항목만 작품명·승인 정보를 입력하세요. ‘판매 중’은 공식 판매처 링크가 있어야 선택할 수 있습니다.</p>
        <div class="table-wrap"><table class="tbl"><thead><tr><th scope="col">번호</th><th scope="col">작품명</th><th scope="col">상태</th><th scope="col">승인 플랫폼</th><th scope="col">수정일</th><th scope="col"><span class="sr-only">작업</span></th></tr></thead><tbody>
          ${works.map(w => `<tr><td><span class="swatch" style="background:${w.tint}" aria-hidden="true"></span>${String(w.no).padStart(2, '0')}</td>
            <td>${w.name ? `<strong>${esc(w.name)}</strong>` : '<span class="muted-text">미입력</span>'}</td>
            <td><span class="badge ${{ empty: 'badge--muted', review: 'badge--blue', approved: 'badge--blue', onsale: 'badge--ok', hidden: 'badge--muted' }[w.status]}">${ER.WORK_STATUS[w.status]}</span></td>
            <td>${w.platform ? esc(w.platform) : '<span class="muted-text">미입력</span>'}</td>
            <td>${fmtDate(w.updatedAt)}</td>
            <td class="tbl__actions">${edit ? `<button type="button" class="btn btn--ghost btn--xs" data-work="${w.id}">수정</button>` : ''}<a class="btn btn--ghost btn--xs" href="page.html?p=work&id=${w.id}" target="_blank" rel="noopener">보기<span class="sr-only"> (새 창)</span></a></td></tr>`).join('')}
        </tbody></table></div>
      </section>
      <section class="panel">
        <div class="panel__head"><h2 class="panel__title">소식·이벤트</h2>${edit ? '<button type="button" class="btn btn--primary btn--sm" id="add-news">소식 등록</button>' : ''}</div>
        ${news.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th scope="col">분류</th><th scope="col">제목</th><th scope="col">등록일</th><th scope="col">공개</th><th scope="col"><span class="sr-only">작업</span></th></tr></thead><tbody>
          ${news.map(n => `<tr><td>${ER.NEWS_TYPES[n.type]}</td><td>${n.important ? '<span class="badge badge--coral">중요</span> ' : ''}${esc(n.title)}</td><td>${fmtDate(n.createdAt)}</td>
            <td>${n.status === 'published' ? '<span class="badge badge--ok">● 공개</span>' : '<span class="badge badge--muted">■ 비공개</span>'}</td>
            <td class="tbl__actions">${edit ? `<button type="button" class="btn btn--ghost btn--xs" data-news="${n.id}" data-to="${n.status === 'published' ? 'hidden' : 'published'}">${n.status === 'published' ? '비공개' : '공개'}</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="adm-empty"><strong>등록된 소식이 없습니다</strong></div>'}
      </section>`;
    },

    community() {
      const s = state.community;
      const all = ER.listPosts({ includeHidden: true });
      const list = s.reported ? all.filter(p => p.reports > 0) : all;
      view.innerHTML = `
      <section class="panel">
        <div class="toolbar"><label class="check"><input type="checkbox" id="only-rep" ${s.reported ? 'checked' : ''}> 신고된 글만 보기</label><span class="toolbar__count">${list.length}건</span></div>
        ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th scope="col">태그</th><th scope="col">제목</th><th scope="col">작성자</th><th scope="col">작성일</th><th scope="col">신고</th><th scope="col">상태</th><th scope="col"><span class="sr-only">작업</span></th></tr></thead><tbody>
          ${list.map(p => `<tr><td><span class="tag">${esc(p.tag)}</span></td><td><a class="text-link" href="page.html?p=post&id=${p.id}" target="_blank" rel="noopener">${esc(p.title)}<span class="sr-only"> (새 창)</span></a></td>
            <td>${esc(p.author)}</td><td>${fmtDate(p.createdAt)}</td><td>${p.reports ? `<span class="badge badge--err">${p.reports}</span>` : '0'}</td>
            <td>${p.status === 'published' ? '<span class="badge badge--ok">● 공개</span>' : `<span class="badge badge--muted" title="${esc(p.moderationReason || '')}">■ 숨김</span>`}</td>
            <td class="tbl__actions"><button type="button" class="btn btn--ghost btn--xs" data-post="${p.id}" data-to="${p.status === 'published' ? 'hidden' : 'published'}">${p.status === 'published' ? '숨김' : '복원'}</button></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="adm-empty"><strong>${s.reported ? '신고된 글이 없습니다' : '아직 게시글이 없습니다'}</strong><p>팬 라운지에 글이 등록되면 여기에서 관리할 수 있어요.</p></div>`}
      </section>`;
      $('#only-rep').addEventListener('change', e => { s.reported = e.target.checked; route(); });
    },

    orders() {
      const s = state.orders;
      const keys = periodKeys(days); const kset = new Set(keys);
      const all = ER.listOrders(me).filter(o => kset.has(dayKey(o.paidAt))).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
      const list = s.status ? all.filter(o => o.status === s.status) : all;
      const st = orderStats(all, keys);
      const size = 15; const page = Math.min(s.page, Math.max(1, Math.ceil(list.length / size)));
      view.innerHTML = `
      <section class="kpis kpis--3" aria-label="기간 매출 요약">
        <article class="kpi kpi--demo"><h2 class="kpi__label">결제액 <span class="badge badge--warn">데모</span></h2><p class="kpi__value">${fmtWon(st.pay)}</p><span class="kpi__delta">${st.n}건 · 최근 ${days}일</span></article>
        <article class="kpi kpi--demo"><h2 class="kpi__label">환불액 <span class="badge badge--warn">데모</span></h2><p class="kpi__value">${fmtWon(st.refund)}</p><span class="kpi__delta">완료된 환불 합계</span></article>
        <article class="kpi kpi--demo"><h2 class="kpi__label">순매출 표시값 <span class="badge badge--warn">데모</span></h2><p class="kpi__value">${fmtWon(st.net)}</p><span class="kpi__delta">결제액 − 환불액 (회계 매출 아님)</span></article>
      </section>
      <section class="panel">
        <div class="toolbar">
          <label for="o-st">결제 상태</label>
          <select id="o-st" class="input input--sm"><option value="">전체</option><option value="paid"${s.status === 'paid' ? ' selected' : ''}>결제 완료</option><option value="refunded"${s.status === 'refunded' ? ' selected' : ''}>환불</option></select>
          <span class="toolbar__count">${list.length}건</span>
        </div>
        ${list.length ? ordersTable(list.slice((page - 1) * size, page * size)) : '<div class="adm-empty"><strong>해당 기간의 주문이 없습니다</strong><p>결제 연동 전이거나 데모 주문이 삭제된 상태입니다.</p></div>'}
        <p class="panel__note">실제 결제는 결제사 서명 검증 또는 서버 조회로 확인된 이벤트만 기록해야 합니다. 현재 목록은 모두 데모 데이터입니다.</p>
      </section>`;
      $('#o-st').addEventListener('change', e => { s.status = e.target.value; s.page = 1; route(); });
      view.querySelector('.panel').appendChild(pager(list.length, page, size, p => { s.page = p; route(); }));
    },

    service() {
      const h = ER.health();
      view.innerHTML = `
      <div class="adm-grid adm-grid--2">
        <section class="panel"><div class="panel__head"><h2 class="panel__title">Firebase Authentication · Firestore</h2>${healthBadge(h.ok ? 'ok' : 'err')}</div>
          <dl class="kv"><div><dt>프로젝트</dt><dd>${esc(ER.projectId)} (${ER.ENV})</dd></div><div><dt>판정 기준</dt><dd>공개 컬렉션 읽기 성공</dd></div><div><dt>응답 시간</dt><dd>${h.latencyMs}ms</dd></div><div><dt>측정 시각</dt><dd>${fmtDateTime(h.checkedAt)}</dd></div></dl></section>
        <section class="panel"><div class="panel__head"><h2 class="panel__title">Cloud Functions</h2>${healthBadge('na')}</div>
          <p class="panel__note panel__note--top">아직 배포된 서버 함수가 없습니다(Blaze 요금제 필요). 역할 부여·결제 처리·자동 감사 기록을 서버로 옮길 때 연결합니다.</p></section>
        <section class="panel"><div class="panel__head"><h2 class="panel__title">결제 웹훅</h2>${healthBadge('na')}</div>
          <p class="panel__note panel__note--top">결제사가 정해지지 않았습니다. 서명 검증·중복 이벤트 처리 후 최종 수신 시각을 표시합니다.</p></section>
        <section class="panel"><div class="panel__head"><h2 class="panel__title">예약 집계 작업</h2>${healthBadge('na')}</div>
          <p class="panel__note panel__note--top">일별 집계(metricsDaily)는 Cloud Functions 연결 후 최종 성공 시각을 표시합니다.</p></section>
      </div>`;
    },

    audit() {
      const s = state.audit;
      const all = ER.listAudit(me);
      const q = s.q.trim().toLowerCase();
      const list = q ? all.filter(a => (a.actor + a.action + a.target).toLowerCase().includes(q)) : all;
      view.innerHTML = `<section class="panel">
        <div class="toolbar"><label class="sr-only" for="a-q">감사 로그 검색</label><input id="a-q" class="input" type="search" placeholder="실행자, 작업, 대상 검색" value="${esc(s.q)}"><span class="toolbar__count">${list.length}건</span></div>
        ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th scope="col">시각</th><th scope="col">실행자</th><th scope="col">작업</th><th scope="col">대상</th><th scope="col">결과</th></tr></thead><tbody>
          ${list.slice(0, 100).map(a => `<tr><td class="nowrap">${fmtDateTime(a.at)}</td><td>${esc(a.actor)}</td><td>${esc(a.action)}</td><td>${esc(a.target)}</td><td>${a.outcome === '성공' ? '<span class="badge badge--ok">성공</span>' : `<span class="badge badge--err">${esc(a.outcome)}</span>`}</td></tr>`).join('')}
        </tbody></table></div>` : '<div class="adm-empty"><strong>기록이 없습니다</strong></div>'}
      </section>`;
      const qi = $('#a-q');
      let t; qi.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { s.q = qi.value; route(); const v = $('#a-q'); v.focus(); v.setSelectionRange(v.value.length, v.value.length); }, 250); });
    },

    settings() {
      const permRows = [
        ['admin.access', '대시보드 접근'], ['members.view', '회원 조회'], ['members.status', '회원 상태 변경'], ['members.role', '관리자 역할 부여·회수'],
        ['content.edit', '작품·소식 편집'], ['community.edit', '게시글 숨김·복원'], ['orders.view', '주문·매출 조회'], ['audit.view', '감사 로그 조회'], ['settings.edit', '데모 데이터 관리']
      ];
      const roles = ['superAdmin', 'operator', 'finance', 'viewer'];
      const fake = (role) => ({ role, status: 'active' });
      view.innerHTML = `
      <div class="adm-grid adm-grid--2">
        <section class="panel"><div class="panel__head"><h2 class="panel__title">내 계정</h2></div>
          <dl class="kv"><div><dt>닉네임</dt><dd>${esc(me.nickname)}</dd></div><div><dt>이메일</dt><dd>${esc(me.email)}</dd></div><div><dt>역할</dt><dd>${ER.ROLES[me.role]}</dd></div></dl></section>
        <section class="panel"><div class="panel__head"><h2 class="panel__title">데모 데이터</h2></div>
          <p class="panel__note panel__note--top">결제 연동 전 화면 확인용 주문입니다. Firestore에는 저장되지 않고 이 브라우저 화면에만 표시됩니다.</p>
          <p>현재: ${ER.demoEnabled() ? '<span class="badge badge--warn">데모 주문 표시 중</span>' : '<span class="badge badge--muted">데모 주문 숨김</span>'}</p>
          ${ER.ENV !== 'dev' ? '<p class="muted-text">운영 환경에서는 데모 주문을 표시하지 않습니다.</p>' : can('settings.edit') ? `<div class="btn-row"><button type="button" class="btn btn--ghost btn--sm" id="demo-toggle">${ER.demoEnabled() ? '데모 주문 숨기기' : '데모 주문 표시하기'}</button></div>` : '<p class="muted-text">최고 관리자만 변경할 수 있습니다.</p>'}</section>
      </div>
      <section class="panel"><div class="panel__head"><h2 class="panel__title">역할별 권한</h2></div>
        <div class="table-wrap"><table class="tbl tbl--matrix"><thead><tr><th scope="col">권한</th>${roles.map(r => `<th scope="col">${ER.ROLES[r]}</th>`).join('')}</tr></thead><tbody>
          ${permRows.map(([p, l]) => `<tr><th scope="row">${l}</th>${roles.map(r => `<td>${ER.can(fake(r), p) ? '<span class="yes">✓<span class="sr-only"> 허용</span></span>' : '<span class="no">–<span class="sr-only"> 불가</span></span>'}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div></section>
      <section class="panel"><div class="panel__head"><h2 class="panel__title">운영 전환 체크리스트 (Firebase)</h2></div>
        <ul class="checklist">
          <li class="done">개발 프로젝트(${esc(ER.projectId)}) 연결 · Authentication · Firestore 사용</li>
          <li class="done">관리자 역할: Custom Claims + adminAccess 문서 이중 확인</li>
          <li>Security Rules 거부 사례 테스트(에뮬레이터) 및 운영 프로젝트(prod) 분리</li>
          <li>Blaze 전환 후 역할 변경·감사 기록을 Cloud Functions로 이전</li>
          <li>결제사 확정 후 웹훅 서명 검증·중복 이벤트 방지 구현, 데모 주문 제거</li>
          <li>사업자 정보·약관·개인정보처리방침 확정 후 푸터 반영</li>
        </ul></section>`;
      const tg = $('#demo-toggle');
      if (tg) tg.addEventListener('click', () => { try { ER.setDemoOrders(me, !ER.demoEnabled()); toast('설정을 바꿨어요.', 'ok'); route(); } catch (e) { toast(e.message, 'err'); } });
    }
  };

  function ordersTable(rows) {
    if (!rows.length) return '<div class="adm-empty adm-empty--sm"><strong>주문이 없습니다</strong></div>';
    return `<div class="table-wrap"><table class="tbl"><thead><tr><th scope="col">주문 번호</th><th scope="col">구매자</th><th scope="col">상품</th><th scope="col" class="num">결제액</th><th scope="col" class="num">환불액</th><th scope="col">상태</th><th scope="col">결제 시각</th></tr></thead><tbody>
      ${rows.map(o => `<tr><td class="nowrap">${esc(o.id)}</td><td class="nowrap">${esc(o.buyer)}</td><td class="nowrap">${esc(o.product)} × ${o.qty}</td><td class="num">${fmtWon(o.amountMinor)}</td><td class="num">${o.refundMinor ? fmtWon(o.refundMinor) : '-'}</td>
        <td>${o.status === 'paid' ? '<span class="badge badge--ok">● 결제 완료</span>' : '<span class="badge badge--coral">↺ 환불</span>'}</td><td class="nowrap">${fmtDateTime(o.paidAt)}</td></tr>`).join('')}
    </tbody></table></div>`;
  }
  function healthBadge(s) {
    return { ok: '<span class="badge badge--ok">● 정상</span>', err: '<span class="badge badge--err">✕ 오류</span>', na: '<span class="badge badge--muted">○ 확인 불가</span>' }[s];
  }

  /* ---------- 작업 핸들러 ---------- */
  function onMemberAction(e) {
    const sb = e.target.closest('[data-status]'), rb = e.target.closest('[data-role]');
    if (!sb && !rb) return;
    const u = ER.listUsers().find(x => x.uid === (sb || rb).dataset[sb ? 'status' : 'role']);
    if (!u) return;
    if (sb) {
      const to = u.status === 'active' ? 'disabled' : 'active';
      openModal({
        title: to === 'disabled' ? '계정 비활성화' : '계정 활성화', ok: to === 'disabled' ? '비활성화' : '활성화', danger: to === 'disabled',
        body: `<p class="modal__target"><strong>${esc(u.nickname)}</strong> (${esc(maskEmail(u.email))})</p>
          ${to === 'disabled' ? '<p class="muted-text">비활성화하면 이 계정은 즉시 로그아웃되고 다시 로그인할 수 없습니다.</p>' : ''}
          <div class="field"><label for="m-reason">사유 (감사 로그에 기록)</label><textarea id="m-reason" name="reason" rows="3" maxlength="200" required></textarea></div>`,
        onSubmit: async (f) => { await ER.setUserStatus(me, u.uid, to, f.reason.value); toast('계정 상태를 변경했어요.', 'ok'); }
      });
    } else {
      openModal({
        title: '역할 변경', ok: '변경',
        body: `<p class="modal__target"><strong>${esc(u.nickname)}</strong> · 현재 ${ER.ROLES[u.role]}</p>
          <div class="field"><label for="m-role">새 역할</label><select id="m-role" name="role">${Object.entries(ER.ROLES).map(([k, v]) => `<option value="${k}"${k === u.role ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
          <p class="muted-text">운영 환경에서는 서버가 Custom Claims로 역할을 부여해야 합니다.</p>`,
        onSubmit: (f) => { if (f.role.value === u.role) throw new Error('현재와 같은 역할입니다.'); ER.setUserRole(me, u.uid, f.role.value); toast('역할을 변경했어요.', 'ok'); }
      });
    }
  }

  function onContentAction(e) {
    const wb = e.target.closest('[data-work]'), nb = e.target.closest('[data-news]'), add = e.target.closest('#add-news');
    if (wb) {
      const w = ER.getWork(wb.dataset.work);
      openModal({
        title: `작품 ${String(w.no).padStart(2, '0')} 수정`,
        body: `<div class="field"><label for="f-name">작품명</label><input id="f-name" name="wname" maxlength="40" value="${esc(w.name)}"></div>
          <div class="field"><label for="f-concept">한 줄 콘셉트</label><input id="f-concept" name="concept" maxlength="80" value="${esc(w.concept)}"></div>
          <div class="modal__row">
            <div class="field"><label for="f-platform">승인 플랫폼</label><input id="f-platform" name="platform" maxlength="30" value="${esc(w.platform)}"></div>
            <div class="field"><label for="f-status">상태</label><select id="f-status" name="status">${Object.entries(ER.WORK_STATUS).map(([k, v]) => `<option value="${k}"${k === w.status ? ' selected' : ''}>${v}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label for="f-url">공식 판매처 링크</label><input id="f-url" name="saleUrl" type="url" placeholder="https://" value="${esc(w.saleUrl)}"></div>
          <div class="field"><label for="f-story">캐릭터 스토리</label><textarea id="f-story" name="story" rows="4" maxlength="2000">${esc(w.story)}</textarea></div>`,
        onSubmit: async (f) => {
          const url = f.saleUrl.value.trim();
          if (url && !/^https?:\/\//.test(url)) throw new Error('판매처 링크는 http:// 또는 https://로 시작해야 합니다.');
          await ER.updateWork(me, w.id, { name: f.wname.value.trim(), concept: f.concept.value.trim(), platform: f.platform.value.trim(), status: f.status.value, saleUrl: url, story: f.story.value.trim() });
          toast('작품 정보를 저장했어요.', 'ok');
        }
      });
    }
    if (nb) { if (!refreshMe()) return; nb.disabled = true; ER.setNewsStatus(me, nb.dataset.news, nb.dataset.to).then(() => { toast('공개 상태를 변경했어요.', 'ok'); route(); }).catch(err => { toast(err.message, 'err'); nb.disabled = false; }); }
    if (add) openModal({
      title: '소식 등록', ok: '등록',
      body: `<div class="modal__row"><div class="field"><label for="n-type">분류</label><select id="n-type" name="type">${Object.entries(ER.NEWS_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="field field--check"><label><input type="checkbox" name="important"> 중요 표시</label></div></div>
        <div class="field"><label for="n-title">제목</label><input id="n-title" name="ntitle" maxlength="60" required></div>
        <div class="field"><label for="n-body">내용</label><textarea id="n-body" name="body" rows="5" maxlength="3000" required></textarea></div>`,
      onSubmit: async (f) => { await ER.addNews(me, { type: f.type.value, title: f.ntitle.value, body: f.body.value, important: f.important.checked }); toast('소식을 등록했어요.', 'ok'); }
    });
  }

  function onCommunityAction(e) {
    const b = e.target.closest('[data-post]'); if (!b) return;
    const to = b.dataset.to;
    const p = ER.listPosts({ includeHidden: true }).find(x => x.id === b.dataset.post);
    openModal({
      title: to === 'hidden' ? '게시글 숨김' : '게시글 복원', ok: to === 'hidden' ? '숨김' : '복원', danger: to === 'hidden',
      body: `<p class="modal__target"><strong>${esc(p.title)}</strong> · ${esc(p.author)}</p>
        <div class="field"><label for="p-reason">사유${to === 'hidden' ? '' : ' (선택)'}</label><textarea id="p-reason" name="reason" rows="3" maxlength="200"></textarea></div>`,
      onSubmit: async (f) => {
        if (to === 'hidden' && !f.reason.value.trim()) throw new Error('숨김 사유를 입력해 주세요.');
        await ER.setPostStatus(me, p.id, to, f.reason.value.trim()); toast(to === 'hidden' ? '게시글을 숨겼어요.' : '게시글을 복원했어요.', 'ok');
      }
    });
  }

  /* ---------- 시작 ---------- */
  ER.ready.then(() => {
    if (!refreshMe()) return;
    renderShell();
    route(true);
  });
})();

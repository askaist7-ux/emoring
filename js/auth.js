/* 로그인·회원가입 폼 */
(function () {
  // 로그인 후 돌아갈 주소: 같은 사이트의 html 파일만 허용(외부 이동 방지)
  const safeNext = () => {
    const n = new URLSearchParams(location.search).get('next') || '';
    return /^[a-z-]+\.html(\?[^\s<>"']*)?$/i.test(n) ? n : 'index.html';
  };

  const sun = document.getElementById('auth-sun');
  if (sun) sun.innerHTML = sunnyMini();

  document.querySelectorAll('.pw__toggle').forEach(btn => btn.addEventListener('click', () => {
    const input = document.getElementById(btn.getAttribute('aria-controls'));
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? '숨기기' : '보기';
    btn.setAttribute('aria-pressed', String(show));
  }));

  const setBusy = (form, busy) => {
    const b = form.querySelector('[type=submit]');
    b.disabled = busy;
    b.dataset.label = b.dataset.label || b.textContent;
    b.textContent = busy ? '처리 중…' : b.dataset.label;
  };
  const markInvalid = (input, bad) => input.setAttribute('aria-invalid', String(!!bad));

  /* ---------- 로그인 ---------- */
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    ER.ready.then(() => { if (ER.currentUser()) location.replace(safeNext()); });
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('login-error');
      const email = loginForm.email, pw = loginForm.password;
      err.textContent = '';
      markInvalid(email, !email.value.trim()); markInvalid(pw, !pw.value);
      if (!email.value.trim() || !pw.value) { err.textContent = '이메일과 비밀번호를 입력해 주세요.'; (email.value.trim() ? pw : email).focus(); return; }
      setBusy(loginForm, true);
      try {
        const user = await ER.login(email.value, pw.value, document.getElementById('remember').checked);
        toast(`${user.nickname}님, 반가워요!`, 'ok');
        const next = new URLSearchParams(location.search).get('next') ? safeNext() : (ER.can(user, 'admin.access') ? 'admin.html' : 'index.html');
        setTimeout(() => location.href = next, 500);
      } catch (ex) {
        err.textContent = ex.message;
        setBusy(loginForm, false);
        pw.select();
      }
    });
  }

  /* ---------- 회원가입 ---------- */
  const form = document.getElementById('signup-form');
  if (form) {
    const pw = form.password, pw2 = form.password2;
    const rules = form.querySelectorAll('#pw-rules li');
    pw.addEventListener('input', () => {
      const probs = ER.pwProblems(pw.value);
      rules.forEach(li => li.classList.toggle('is-ok', pw.value && !probs.includes(li.dataset.rule)));
    });

    const all = document.getElementById('agree-all');
    const items = [...form.querySelectorAll('.agree-item')];
    all.addEventListener('change', () => items.forEach(i => i.checked = all.checked));
    items.forEach(i => i.addEventListener('change', () => all.checked = items.every(x => x.checked)));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('signup-error');
      err.textContent = '';
      form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
      const fail = (input, msg) => { err.textContent = msg; markInvalid(input, true); input.focus(); };

      if (!form.elements['name'].value.trim()) return fail(form.elements['name'], '이름을 입력해 주세요.');
      if (form.nickname.value.trim().length < 2) return fail(form.nickname, '닉네임은 2자 이상 입력해 주세요.');
      if (!form.email.validity.valid || !form.email.value) return fail(form.email, '이메일 형식을 확인해 주세요.');
      const probs = ER.pwProblems(pw.value);
      if (probs.length) return fail(pw, `비밀번호는 ${probs.join(', ')} 조건이 필요해요.`);
      if (pw.value !== pw2.value) return fail(pw2, '비밀번호가 서로 일치하지 않아요.');
      if (!document.getElementById('agree-terms').checked) return fail(document.getElementById('agree-terms'), '이용약관에 동의해 주세요.');
      if (!document.getElementById('agree-privacy').checked) return fail(document.getElementById('agree-privacy'), '개인정보 수집·이용에 동의해 주세요.');

      setBusy(form, true);
      try {
        await ER.signup({ email: form.email.value, password: pw.value, name: form.elements['name'].value, nickname: form.nickname.value, marketing: document.getElementById('agree-marketing').checked });
        toast('가입을 환영해요! 팬 라운지에서 첫 인사를 남겨 보세요.', 'ok');
        setTimeout(() => location.href = 'page.html?p=lounge', 700);
      } catch (ex) {
        err.textContent = ex.message;
        setBusy(form, false);
      }
    });
  }
})();

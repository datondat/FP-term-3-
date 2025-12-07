/* public/index.js
   Full runtime for index.html (includes logout functionality).
   - populateSubjects, showSubjectDetail
   - search/autocomplete (light)
   - inline login handler (AJAX)
   - loadUser and doLogout (server logout at /logout.php or /api/logout)
*/
(function () {
  'use strict';

  // --- Data ---
  const classSubjects = {
    6: ['Toán','Ngữ văn','Tiếng Anh','Khoa học tự nhiên','Lịch sử','Địa lí','Tin học','Công nghệ','GDCD'],
    7: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Công nghệ'],
    8: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Tin học'],
    9: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','GDQPAN'],
    10: ['Toán (Tự chọn/Chuyên)','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDCD'],
    11: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDQPAN'],
    12: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','Lịch sử & Địa lí'],
    common: ['Giáo dục công dân','Công nghệ','Khoa học tự nhiên','Giáo dục kinh tế và pháp luật']
  };

  // --- Helpers ---
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function debounce(fn, wait) {
    let t;
    return function(...args){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,args), wait); };
  }

  // --- Elements ---
  const searchForm = $('.search-form');
  const inputEl = searchForm ? searchForm.querySelector('.search-input') : null;
  const statusBlock = $('#status-block');
  const userCard = $('#user-card');
  const userInfoEl = $('#user-info');
  const btnLoginHeader = $('#link-login') || $('#btn-login-header');
  const btnRegisterHeader = $('#link-register') || $('#btn-register-header');

  // --- Populate subjects ---
  function populateSubjects() {
    Object.keys(classSubjects).forEach(key => {
      const id = (/^\d+$/.test(key) ? 'grade-' + key : 'grade-common');
      const ul = document.getElementById(id);
      if (!ul) return;
      ul.innerHTML = '';
      classSubjects[key].forEach(sub => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'subject';
        a.textContent = sub;
        a.dataset.subject = sub;
        a.dataset.grade = /^\d+$/.test(key) ? key : '';
        a.setAttribute('data-desc', `Mô tả mẫu cho môn "${sub}"`);
        li.appendChild(a);
        ul.appendChild(li);
      });
    });
  }

  // --- Subject detail UI ---
  const detailWrap = $('#subject-detail');
  const detailTitle = $('#subject-title');
  const detailDesc = $('#subject-desc');
  const detailBooks = $('#subject-books');

  function hoc10Search(subject, grade) {
    return 'https://www.hoc10.vn/tim-kiem?q=' + encodeURIComponent(subject + (grade ? ' ' + grade : ''));
  }

  function showSubjectDetail(subject, grade) {
    if (!detailWrap) return;
    detailTitle.textContent = subject;
    detailDesc.textContent = `Tài liệu tham khảo và liên kết cho ${subject}${grade ? ' (Lớp ' + grade + ')' : ''}.`;
    detailBooks.innerHTML = '';

    const linkHoc10 = document.createElement('a');
    linkHoc10.href = hoc10Search(subject, grade);
    linkHoc10.target = '_blank';
    linkHoc10.rel = 'noopener noreferrer';
    linkHoc10.className = 'book-link';
    linkHoc10.textContent = `Tìm sách trên hoc10 cho ${subject}${grade ? ' — Lớp ' + grade : ''}`;
    detailBooks.appendChild(linkHoc10);

    const exampleLinks = [
      { label: 'Giáo án mẫu', url: '#' },
      { label: 'Đề kiểm tra mẫu', url: '#' }
    ];
    const ul = document.createElement('ul');
    ul.className = 'resource-list';
    exampleLinks.forEach(it => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = it.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = it.label;
      li.appendChild(a);
      ul.appendChild(li);
    });
    detailBooks.appendChild(ul);

    detailWrap.style.display = 'block';
    try { detailWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e){}
  }

  // --- Delegation ---
  function installSubjectDelegation() {
    const container = document.querySelector('.subjects-view') || document.body;
    if (container._delegationInstalled) return;
    container.addEventListener('click', function (e) {
      let el = e.target;
      while (el && el !== container) {
        if (el.matches && el.matches('a.subject')) {
          e.preventDefault();
          const subject = el.dataset.subject || el.textContent.trim();
          const grade = el.dataset.grade || '';
          if (window.FP && typeof window.FP.showSubjectDetail === 'function') {
            try { window.FP.showSubjectDetail(subject, grade); return; } catch (e) {}
          }
          showSubjectDetail(subject, grade);
          return;
        }
        el = el.parentNode;
      }
    }, false);
    container._delegationInstalled = true;
  }

  // --- Search/autocomplete (light) ---
  const dropdownId = 'searchAutocomplete';
  let dropdown = document.getElementById(dropdownId);
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = dropdownId;
    dropdown.className = 'search-autocomplete hidden';
    document.body.appendChild(dropdown);
  }
  let suggestions = [], activeIndex = -1;
  function positionDropdown() {
    if (!inputEl) return;
    const rect = inputEl.getBoundingClientRect();
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    dropdown.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    dropdown.style.width = Math.max(240, rect.width) + 'px';
  }
  function showDropdown(items) {
    suggestions = items || [];
    activeIndex = -1;
    dropdown.innerHTML = '';
    if (!items || !items.length) { dropdown.classList.add('hidden'); return; }
    const ul = document.createElement('ul'); ul.className = 'autocomplete-list';
    items.forEach((it, i) => {
      const li = document.createElement('li'); li.className = 'autocomplete-item';
      li.innerHTML = `<div class="title">${escapeHtml(it.title || it.name)}</div><div class="meta">${escapeHtml(it.meta || '')}</div>`;
      li.addEventListener('click', (ev) => { ev.stopPropagation(); selectSuggestion(i); });
      ul.appendChild(li);
    });
    dropdown.appendChild(ul);
    dropdown.classList.remove('hidden');
    positionDropdown();
  }
  function hideDropdown() { dropdown.classList.add('hidden'); suggestions = []; activeIndex = -1; }
  function selectSuggestion(i) {
    const it = suggestions[i];
    if (!it) return;
    if (it.url) window.location.href = it.url;
    else { if (inputEl) inputEl.value = it.title || it.name || ''; hideDropdown(); performSearch(inputEl.value); }
  }
  function highlightActive() {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
  }

  if (inputEl) {
    inputEl.addEventListener('input', debounce(function (e) {
      const q = e.target.value || '';
      if (!q) { hideDropdown(); return; }
      const all = [];
      Object.values(classSubjects).forEach(arr => arr.forEach(s => all.push(s)));
      const filtered = [...new Set(all)].filter(s => s.toLowerCase().includes(q.toLowerCase())).slice(0, 6).map(x => ({ title: x, meta: '' }));
      showDropdown(filtered);
    }, 150));
    window.addEventListener('resize', positionDropdown);
    window.addEventListener('scroll', positionDropdown);
    inputEl.addEventListener('keydown', (e) => {
      if (dropdown.classList.contains('hidden')) return;
      const len = suggestions.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = (activeIndex + 1) % len; highlightActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = (activeIndex - 1 + len) % len; highlightActive(); }
      else if (e.key === 'Enter') { if (activeIndex >= 0) { e.preventDefault(); selectSuggestion(activeIndex); } else { e.preventDefault(); performSearch(inputEl.value); } }
      else if (e.key === 'Escape') { hideDropdown(); }
    });
  }
  document.addEventListener('click', (e) => { if (!dropdown.contains(e.target) && e.target !== inputEl) hideDropdown(); });

  // --- Results (API) ---
  const resultsContainerId = 'searchResultsContainer';
  let resultsContainer = document.getElementById(resultsContainerId);
  if (!resultsContainer) {
    resultsContainer = document.createElement('section');
    resultsContainer.id = resultsContainerId;
    resultsContainer.className = 'search-results';
    const mainNode = document.querySelector('main') || null;
    document.body.insertBefore(resultsContainer, mainNode);
  }
  async function doSearch(q, page = 1) {
    if (!q) { resultsContainer.innerHTML = '<p class="no-results">Không tìm thấy kết quả.</p>'; return; }
    resultsContainer.innerHTML = '<p class="loading">Đang tìm kiếm…</p>';
    try {
      const r = await fetch('/api/search?q=' + encodeURIComponent(q) + '&page=' + page + '&limit=10', { credentials: 'include' });
      if (!r.ok) { resultsContainer.innerHTML = `<p class="error">Lỗi khi tìm kiếm: ${r.status} ${r.statusText}</p>`; return; }
      const data = await r.json();
      if (!data || !data.results || data.results.length === 0) { resultsContainer.innerHTML = '<p class="no-results">Không tìm thấy kết quả.</p>'; return; }
      let html = `<div class="results-info">Tìm thấy ${data.total || data.results.length} kết quả — Trang ${data.page || 1}</div><div class="results-list">`;
      data.results.forEach(r2 => {
        const it = r2.item || r2;
        html += `<article class="result-card"><h3 class="result-title"><a href="${escapeHtml(it.url || '#')}" target="_blank">${escapeHtml(it.title || (it.name || '(Không tiêu đề)'))}</a></h3>
                 <div class="result-meta">${escapeHtml(it.subject || '')}</div>
                 <p class="result-snippet">${escapeHtml((it.content || '').slice(0, 250))}...</p></article>`;
      });
      html += '</div>';
      resultsContainer.innerHTML = html;
    } catch (err) {
      resultsContainer.innerHTML = `<p class="error">Lỗi khi tìm kiếm: ${escapeHtml(err.message)}</p>`;
    }
  }
  function performSearch(q) { if (!q) return; doSearch(q, 1); }

  if (searchForm) searchForm.addEventListener('submit', function (e) { e.preventDefault(); performSearch(inputEl ? inputEl.value : new FormData(searchForm).get('q')); hideDropdown(); });

  // --- Inline login (if exists) ---
  const inlineLoginForm = $('#inlineLoginForm');
  if (inlineLoginForm) {
    inlineLoginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = inlineLoginForm.querySelector('button[type="submit"], input[type="submit"]');
      if (btn) btn.disabled = true;
      const fd = new FormData(inlineLoginForm);
      const payload = { username: fd.get('username'), password: fd.get('password') };
      function showInlineError(msg) {
        let el = inlineLoginForm.querySelector('.inline-login-error');
        if (!el) { el = document.createElement('div'); el.className = 'inline-login-error err'; inlineLoginForm.prepend(el); }
        el.textContent = msg;
      }
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        if (res.redirected) { window.location.replace(res.url); return; }
        const ct = res.headers.get('content-type') || '';
        if (ct.indexOf('application/json') !== -1) {
          const json = await res.json();
          if (res.ok && (json.ok || json.token)) {
            try {
              const remember = !!inlineLoginForm.querySelector('input[name="remember"]:checked');
              if (json.token) { if (remember) localStorage.setItem('auth_token', json.token); else sessionStorage.setItem('auth_token', json.token); }
            } catch (e) {}
            await loadUser();
            const wrap = $('#inlineLogin');
            if (wrap) { wrap.classList.add('hidden'); wrap.setAttribute('aria-hidden', 'true'); }
            return;
          } else {
            showInlineError(json.message || 'Đăng nhập thất bại');
          }
        } else {
          const txt = await res.text();
          showInlineError('Phản hồi không hợp lệ từ server');
          console.debug('login text', txt.slice(0, 200));
        }
      } catch (err) {
        showInlineError('Lỗi mạng, thử lại sau');
      } finally { if (btn) btn.disabled = false; }
    });
  }

  // --- Auth state + logout helpers ---
  function clearAuthStateClientSide() {
    try {
      ['auth_token', 'auth_user', 'token', 'user'].forEach(k => { try { localStorage.removeItem(k); } catch (e) {}; try { sessionStorage.removeItem(k); } catch (e) {}; });
      document.cookie.split(';').forEach(c => {
        const name = c.split('=')[0].trim();
        if (!name) return;
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      });
    } catch (e) {
      console.warn('clearAuthStateClientSide error', e);
    }
  }

  async function updateAuthUI(user) {
    if (user) {
      if (statusBlock) statusBlock.style.display = 'none';
      if (userCard) userCard.classList.remove('hidden');
      if (userInfoEl) userInfoEl.textContent = user.displayName || user.username || (user.email || '');
      if (btnLoginHeader) btnLoginHeader.style.display = 'none';
      if (btnRegisterHeader) btnRegisterHeader.style.display = 'none';
      $$('button#btn-logout, .btn-logout').forEach(b => { b.style.display = ''; });
    } else {
      if (statusBlock) statusBlock.style.display = '';
      if (userCard) userCard.classList.add('hidden');
      if (userInfoEl) userInfoEl.textContent = '';
      if (btnLoginHeader) btnLoginHeader.style.display = '';
      if (btnRegisterHeader) btnRegisterHeader.style.display = '';
      $$('button#btn-logout, .btn-logout').forEach(b => { b.style.display = 'none'; });
    }
  }

  async function loadUser() {
    try {
      const r = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) { await updateAuthUI(null); return null; }
      const j = await r.json().catch(() => null);
      const user = j && j.user ? j.user : null;
      await updateAuthUI(user);
      return user;
    } catch (e) {
      console.warn('loadUser error', e);
      await updateAuthUI(null);
      return null;
    }
  }

  async function serverLogout() {
    try {
      const r = await fetch('/logout.php', { method: 'POST', credentials: 'include', headers: { 'Accept': 'application/json' } });
      if (r.ok) { try { await r.json(); } catch(e){}; return { ok: true, endpoint: '/logout.php' }; }
    } catch (e) { /* ignore */ }
    try {
      const r2 = await fetch('/api/logout', { method: 'POST', credentials: 'include', headers: { 'Accept': 'application/json' } });
      if (r2.ok) { try { await r2.json(); } catch(e){}; return { ok: true, endpoint: '/api/logout' }; }
      return { ok: false, endpoint: '/api/logout', status: r2.status };
    } catch (e) { return { ok: false, error: e }; }
  }

  async function doLogout() {
    try {
      const res = await serverLogout();
      clearAuthStateClientSide();
      await updateAuthUI(null);
      const user = await loadUser();
      if (user) { try { window.location.reload(); } catch(e){ window.location.href = '/'; } }
      return;
    } catch (e) {
      console.error('doLogout error', e);
      clearAuthStateClientSide();
      try { window.location.reload(); } catch (err) { window.location.href = '/'; }
    }
  }

  function installLogoutButtons() {
    $$('button#btn-logout, .btn-logout').forEach(btn => {
      if (btn._installed) return;
      btn.addEventListener('click', function (ev) { ev.preventDefault(); doLogout(); }, { passive: false });
      btn._installed = true;
    });
  }

  // --- Init ---
  document.addEventListener('DOMContentLoaded', function () {
    populateSubjects();
    installSubjectDelegation();
    installLogoutButtons();
    loadUser();

    // attach test button
    const btnTest = document.getElementById('btn-test');
    if (btnTest) {
      btnTest.addEventListener('click', async function () {
        try {
          const r = await fetch('/api/secure-test', { credentials: 'include' });
          const t = await r.text();
          const apiResult = document.getElementById('api-result');
          if (apiResult) apiResult.textContent = `Status ${r.status}: ${t.slice(0,250)}`;
        } catch (e) { console.error(e); }
      });
    }
  });

  // Expose
  window.FP = window.FP || {};
  window.FP.populateSubjects = populateSubjects;
  window.FP.showSubjectDetail = showSubjectDetail;
  window.loadUser = loadUser;
  window.doLogout = doLogout;
  window.clearAuthStateClientSide = clearAuthStateClientSide;

})();
/* public/main.js
   Full client runtime — complete version.
   - populates subject lists
   - handles subject click to show links (hoc10 + example)
   - search/autocomplete (basic)
   - inline login handling (AJAX)
   - loadUser() updates UI (hide/show status, login/register, logout, user-card)
   - doLogout() and logout button installers
*/
document.addEventListener('DOMContentLoaded', () => {
  // mapping lớp -> môn (source of truth)
  const classSubjects = {
    "Lớp 6": ["Toán","Ngữ văn","Tiếng Anh","Khoa học tự nhiên","Lịch sử","Địa lý","Tin học","Công nghệ","GDCD"],
    "Lớp 7": ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học","Lịch sử","Địa lý","Công nghệ"],
    "Lớp 8": ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học","Lịch sử","Địa lý","Tin học"],
    "Lớp 9": ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học","Lịch sử","Địa lý","GDQPAN"],
    "Lớp 10": ["Toán (Tự chọn/Chuyên)","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học","Tin học","GDCD"],
    "Lớp 11": ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học","Tin học","GDQPAN"],
    "Lớp 12": ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học","Tin học","Lịch sử & Địa lí"],
    "Giáo án - Đề thi": ["Đề thi THCS","Đề thi THPT","Giáo án mẫu"]
  };

  // Helper selectors
  const searchForm = document.getElementById('searchForm');
  const inputEl = searchForm ? searchForm.querySelector('.search-input') : null;
  const statusBlock = document.getElementById('status-block');
  const userCard = document.getElementById('user-card');
  const userInfoEl = document.getElementById('user-info');
  const subjectDetailWrap = document.getElementById('subject-detail');
  const subjectTitleEl = document.getElementById('subject-title');
  const subjectDescEl = document.getElementById('subject-desc');
  const subjectBooksEl = document.getElementById('subject-books');

  // header controls
  const btnLoginHeader = document.getElementById('btn-login-header') || document.getElementById('link-login');
  const btnRegisterHeader = document.getElementById('btn-register-header') || document.getElementById('link-register');

  // --- Utilities ---
  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function debounce(fn, wait) {
    let t;
    return function(...args){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,args), wait); };
  }

  // --- Populate subject lists into grade-X <ul> elements ---
  function populateSubjects() {
    Object.keys(classSubjects).forEach(key => {
      // determine matching ul id: if key contains number -> grade-N, else grade-common
      const m = key.match(/\d+/);
      const id = m ? 'grade-' + m[0] : 'grade-common';
      const ul = document.getElementById(id);
      if (!ul) return;
      ul.innerHTML = ''; // reset
      classSubjects[key].forEach(sub => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'subject';
        a.textContent = sub;
        a.dataset.subject = sub;
        a.dataset.grade = m ? m[0] : '';
        a.setAttribute('data-desc', `Mô tả mẫu cho môn "${sub}"`);
        li.appendChild(a);
        ul.appendChild(li);
      });
    });
  }

  // --- Subject detail UI (show links) ---
  function hoc10Search(subject, grade){
    return 'https://www.hoc10.vn/tim-kiem?q=' + encodeURIComponent(subject + (grade ? ' ' + grade : ''));
  }

  function showSubjectDetail(subject, grade){
    if(!subjectDetailWrap) return;
    subjectTitleEl.textContent = subject;
    subjectDescEl.textContent = `Tài liệu tham khảo và liên kết cho ${subject}${grade ? ' (Lớp ' + grade + ')' : ''}.`;
    subjectBooksEl.innerHTML = '';

    // Add direct hoc10 search link
    const linkHoc10 = document.createElement('a');
    linkHoc10.href = hoc10Search(subject, grade);
    linkHoc10.target = '_blank';
    linkHoc10.rel = 'noopener noreferrer';
    linkHoc10.className = 'book-link';
    linkHoc10.textContent = `Tìm sách trên hoc10 cho ${subject}${grade ? ' — Lớp ' + grade : ''}`;
    subjectBooksEl.appendChild(linkHoc10);

    // Add example resource links (could be expanded to real URLs if available)
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
    subjectBooksEl.appendChild(ul);

    subjectDetailWrap.style.display = 'block';
    try { subjectDetailWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e){}
  }

  // --- Delegation: click handler for subject links ---
  function installSubjectDelegation(){
    const container = document.querySelector('.subjects-view') || document.body;
    if(container._fpDelegationInstalled) return;
    container.addEventListener('click', function(e){
      let el = e.target;
      while(el && el !== container){
        if(el.matches && el.matches('a.subject')){
          e.preventDefault();
          const subject = el.dataset.subject || el.textContent.trim();
          const grade = el.dataset.grade || '';
          showSubjectDetail(subject, grade);
          return;
        }
        el = el.parentNode;
      }
    }, false);
    container._fpDelegationInstalled = true;
  }

  // --- Search / Autocomplete (light) ---
  const dropdownId = 'searchAutocomplete';
  let dropdown = document.getElementById(dropdownId);
  if(!dropdown){
    dropdown = document.createElement('div');
    dropdown.id = dropdownId;
    dropdown.className = 'search-autocomplete hidden';
    document.body.appendChild(dropdown);
  }
  let suggestions = [], activeIndex = -1;
  function positionDropdown(){
    if(!inputEl) return;
    const rect = inputEl.getBoundingClientRect();
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    dropdown.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    dropdown.style.width = Math.max(240, rect.width) + 'px';
  }
  function showDropdown(items){
    suggestions = items || [];
    activeIndex = -1;
    dropdown.innerHTML = '';
    if(!items || !items.length){ dropdown.classList.add('hidden'); return; }
    const ul = document.createElement('ul'); ul.className = 'autocomplete-list';
    items.forEach((it,i) => {
      const li = document.createElement('li'); li.className = 'autocomplete-item';
      li.innerHTML = `<div class="title">${escapeHtml(it.title || it.name)}</div><div class="meta">${escapeHtml(it.meta || '')}</div>`;
      li.addEventListener('click', (ev)=>{ ev.stopPropagation(); selectSuggestion(i); });
      ul.appendChild(li);
    });
    dropdown.appendChild(ul);
    dropdown.classList.remove('hidden');
    positionDropdown();
  }
  function hideDropdown(){ dropdown.classList.add('hidden'); suggestions = []; activeIndex = -1; }
  function selectSuggestion(i){
    const it = suggestions[i];
    if(!it) return;
    if(it.url) window.location.href = it.url;
    else { if(inputEl) inputEl.value = it.title || it.name || ''; hideDropdown(); performSearch(inputEl.value); }
  }
  async function performSearch(q){ if(!q) return; try { await doSearch(q,1); } catch(e){} }

  if(inputEl){
    inputEl.addEventListener('input', debounce(async (e)=>{
      const q = e.target.value || '';
      if(!q){ hideDropdown(); return; }
      // lightweight suggestion: search through classSubjects
      const all = [];
      Object.values(classSubjects).forEach(arr => arr.forEach(s => all.push(s)));
      const filtered = [...new Set(all)].filter(s => s.toLowerCase().includes(q.toLowerCase())).slice(0,6).map(x => ({ title: x, meta: '' }));
      showDropdown(filtered);
    }, 150));
    window.addEventListener('resize', positionDropdown);
    window.addEventListener('scroll', positionDropdown);
    inputEl.addEventListener('keydown', (e)=>{
      if(dropdown.classList.contains('hidden')) return;
      const len = suggestions.length;
      if(e.key === 'ArrowDown'){ e.preventDefault(); activeIndex = (activeIndex + 1) % len; highlightActive(); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); activeIndex = (activeIndex - 1 + len) % len; highlightActive(); }
      else if(e.key === 'Enter'){ if(activeIndex >= 0){ e.preventDefault(); selectSuggestion(activeIndex); } else { e.preventDefault(); performSearch(inputEl.value); } }
      else if(e.key === 'Escape'){ hideDropdown(); }
    });
  }
  function highlightActive(){
    const items = dropdown.querySelectorAll('.autocomplete-item');
    items.forEach((el,i)=> el.classList.toggle('active', i === activeIndex));
  }
  document.addEventListener('click', (e)=>{ if(!dropdown.contains(e.target) && e.target !== inputEl) hideDropdown(); });

  // --- Search API (results) ---
  const resultsContainerId = 'searchResultsContainer';
  let resultsContainer = document.getElementById(resultsContainerId);
  if(!resultsContainer){
    resultsContainer = document.createElement('section');
    resultsContainer.id = resultsContainerId;
    resultsContainer.className = 'search-results';
    const mainNode = document.querySelector('main') || null;
    document.body.insertBefore(resultsContainer, mainNode);
  }
  async function doSearch(q, page=1){
    if(!q){ resultsContainer.innerHTML = '<p class="no-results">Không tìm thấy kết quả.</p>'; return; }
    resultsContainer.innerHTML = '<p class="loading">Đang tìm kiếm…</p>';
    try {
      const res = await fetch('/api/search?q=' + encodeURIComponent(q) + '&page=' + page + '&limit=10', { credentials: 'include' });
      if(!res.ok){ resultsContainer.innerHTML = `<p class="error">Lỗi khi tìm kiếm: ${res.status} ${res.statusText}</p>`; return; }
      const data = await res.json();
      // reuse render logic simple:
      if(!data || !data.results || data.results.length === 0){ resultsContainer.innerHTML = '<p class="no-results">Không tìm thấy kết quả.</p>'; return; }
      let html = `<div class="results-info">Tìm thấy ${data.total || data.results.length} kết quả — Trang ${data.page || 1}</div><div class="results-list">`;
      data.results.forEach(r => {
        const it = r.item || r;
        html += `<article class="result-card"><h3 class="result-title"><a href="${escapeHtml(it.url||'#')}" target="_blank">${escapeHtml(it.title||(it.name||'(Không tiêu đề)'))}</a></h3>
                 <div class="result-meta">${escapeHtml(it.subject||'')}</div>
                 <p class="result-snippet">${escapeHtml((it.content||'').slice(0,250))}...</p></article>`;
      });
      html += '</div>';
      resultsContainer.innerHTML = html;
    } catch(err){
      resultsContainer.innerHTML = `<p class="error">Lỗi khi tìm kiếm: ${escapeHtml(err.message)}</p>`;
    }
  }

  if(searchForm) searchForm.addEventListener('submit', (e)=>{ e.preventDefault(); performSearch(inputEl ? inputEl.value : new FormData(searchForm).get('q') ); hideDropdown(); });

  // --- Inline login handling (if you have inline form) ---
  const inlineLoginForm = document.getElementById('inlineLoginForm');
  if(inlineLoginForm){
    inlineLoginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const btn = inlineLoginForm.querySelector('button[type="submit"], input[type="submit"]');
      if(btn) btn.disabled = true;
      const fd = new FormData(inlineLoginForm);
      const payload = { username: fd.get('username'), password: fd.get('password') };
      function showInlineError(msg){
        let el = inlineLoginForm.querySelector('.inline-login-error');
        if(!el){ el = document.createElement('div'); el.className = 'inline-login-error err'; inlineLoginForm.prepend(el); }
        el.textContent = msg;
      }
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        if(res.redirected){ window.location.replace(res.url); return; }
        const ct = res.headers.get('content-type') || '';
        if(ct.indexOf('application/json') !== -1){
          const json = await res.json();
          if(res.ok && (json.ok || json.token)){
            // store token optionally
            try {
              const remember = !!inlineLoginForm.querySelector('input[name="remember"]:checked');
              if(json.token){ if(remember) localStorage.setItem('auth_token', json.token); else sessionStorage.setItem('auth_token', json.token); }
            } catch(e){}
            // update UI
            await loadUser();
            // hide inline form if present
            const inlineWrap = document.getElementById('inlineLogin');
            if(inlineWrap){ inlineWrap.classList.add('hidden'); inlineWrap.setAttribute('aria-hidden','true'); }
            return;
          } else {
            showInlineError(json.message || 'Đăng nhập thất bại');
          }
        } else {
          const txt = await res.text();
          showInlineError('Phản hồi không hợp lệ từ server');
          console.debug('login text', txt.slice(0,200));
        }
      } catch(err){
        showInlineError('Lỗi mạng, thử lại sau');
      } finally { if(btn) btn.disabled = false; }
    });
  }

  // --- AUTH state handling + logout ---
  async function loadUser(){
    try {
      const r = await fetch('/api/me', { credentials: 'include' });
      let j = null;
      try { j = await r.json(); } catch(e){ j = null; }
      const logged = j && j.user ? j.user : null;
      if(logged){
        // hide status block
        if(statusBlock) statusBlock.style.display = 'none';
        if(userCard) userCard.classList.remove('hidden');
        if(userInfoEl) userInfoEl.textContent = logged.displayName || logged.username || (logged.email || '');
        if(btnLoginHeader) btnLoginHeader.style.display = 'none';
        if(btnRegisterHeader) btnRegisterHeader.style.display = 'none';
        // show logout buttons
        document.querySelectorAll('.btn-logout').forEach(b => b.style.display = '');
      } else {
        // logged out
        if(statusBlock) statusBlock.style.display = '';
        if(userCard) userCard.classList.add('hidden');
        if(userInfoEl) userInfoEl.textContent = '';
        if(btnLoginHeader) btnLoginHeader.style.display = '';
        if(btnRegisterHeader) btnRegisterHeader.style.display = '';
        document.querySelectorAll('.btn-logout').forEach(b => b.style.display = 'none');
      }
    } catch(err){
      console.warn('loadUser error', err);
      if(statusBlock) statusBlock.style.display = '';
      if(userCard) userCard.classList.add('hidden');
      if(btnLoginHeader) btnLoginHeader.style.display = '';
      if(btnRegisterHeader) btnRegisterHeader.style.display = '';
      document.querySelectorAll('.btn-logout').forEach(b => b.style.display = 'none');
    }
  }
  window.loadUser = loadUser;

  async function clearAuthStateClientSide(){
    try {
      ['auth_token','auth_user','token','user'].forEach(k => { try{ localStorage.removeItem(k);}catch{}; try{ sessionStorage.removeItem(k);}catch{}; });
      document.cookie.split(';').forEach(c => {
        const name = c.split('=')[0].trim();
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      });
    } catch(e){ console.warn('clearAuthStateClientSide error', e); }
  }

  async function doLogout(){
    try {
      // default uses PHP logout; change path if your server uses another endpoint (e.g., /api/logout)
      await fetch('/logout.php', { method: 'POST', credentials: 'include', headers: { 'Accept': 'application/json' } }).catch(()=>{});
    } catch(e){}
    await clearAuthStateClientSide();
    try { await loadUser(); } catch(e){}
    try { window.location.reload(); } catch(e) { window.location.href = '/'; }
  }
  window.doLogout = doLogout;

  function installLogoutButtons(){
    document.querySelectorAll('.btn-logout').forEach(b => {
      if(b._logoutInstalled) return;
      b.addEventListener('click', (e)=>{ e.preventDefault(); doLogout(); }, { passive: false });
      b._logoutInstalled = true;
    });
  }

  // --- Initialization sequence ---
  populateSubjects();
  installSubjectDelegation();
  installLogoutButtons();
  loadUser();

  // attach test API button if present
  const btnTest = document.getElementById('btn-test');
  if(btnTest){
    btnTest.addEventListener('click', async () => {
      try {
        const r = await fetch('/api/secure-test', { credentials: 'include' });
        const text = await r.text();
        const apiResult = document.getElementById('api-result');
        if(apiResult) apiResult.textContent = `Status ${r.status}: ${text.slice(0,250)}`;
      } catch(e){ console.error(e); }
    });
  }

}); // end DOMContentLoaded
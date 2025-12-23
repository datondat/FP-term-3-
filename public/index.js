// public/index.js
// Merged runtime:
// - booksMap (your subject -> hoc10 links)
// - subject UI, search/autocomplete, auth helpers (loadUser, doLogout)
// - drive files fetch (calls /api/drive-files with Authorization when token present)
// - renders Drive file list above textbook links in subject detail
(function () {
  'use strict';

  // --- Data: subject lists (names only) ---
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

  // --- booksMap: resources pasted by you ---
  const booksMap = {
    /* (map omitted in this header for brevity) */
    '6|Ngữ văn': [
      { label: 'SGK Ngữ văn 6 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-1/1/22/0/' },
      { label: 'SGK Ngữ văn 6 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-2/1/23/0/' },
      { label: 'SBT Ngữ văn 6 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-1/5/50/0/' },
      { label: 'SBT Ngữ văn 6 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-2/5/174/0/' }
    ],
    /* ... keep all other keys exactly as in your original booksMap ... */
    '12|Tin học': [
      { label: 'SGK Tin học 12 - Ứng dụng', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-12-tin-hoc-ung-dung/1/737/0/' },
      { label: 'SGK Tin học 12 - Khoa học máy tính', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-12-khoa-hoc-may-tinh/1/738/0/' },
      { label: 'Chuyên đề Tin học 12 - Ứng dụng', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-tin-hoc-12-tin-hoc-ung-dung/1/749/0/' },
      { label: 'Chuyên đề Tin học 12 - Khoa học máy tính', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-tin-hoc-12-khoa-hoc-may-tinh/1/750/0/' }
    ]
  };

  // expose for debug
  window.BOOKS_MAP = booksMap;

  // --- Helpers ---
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function debounce(fn, wait) { let t; return function(...args){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,args), wait); }; }

  // --- Populate subject lists (names only) ---
  function populateSubjects(){
    Object.keys(classSubjects).forEach(key => {
      const id = (/^\d+$/.test(key) ? 'grade-' + key : 'grade-common');
      const ul = document.getElementById(id);
      if(!ul) return;
      ul.innerHTML = '';
      classSubjects[key].forEach(sub => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'subject';
        a.textContent = sub;
        a.dataset.subject = sub;
        a.dataset.grade = /^\d+$/.test(key) ? key : '';
        li.appendChild(a);
        ul.appendChild(li);
      });
    });
  }

  // --- Resource lookup (supports multiple key formats) ---
  function getResourcesFor(subject, grade){
    const keyA = `${grade}|${subject}`;
    if (booksMap[keyA]) return booksMap[keyA];
    const keyB = `${subject}::${grade || ''}`;
    if (booksMap[keyB]) return booksMap[keyB];
    const keyC = `${subject}::`;
    if (booksMap[keyC]) return booksMap[keyC];
    if (booksMap[subject]) return booksMap[subject];
    return null;
  }

  // --- Subject detail rendering (books + drive files) ---
  const detailWrap = $('#subject-detail');
  const detailTitle = $('#subject-title');
  const detailDesc = $('#subject-desc');
  const detailBooks = $('#subject-books');
  function hoc10Search(subject, grade){ return 'https://www.hoc10.vn/tim-kiem?q=' + encodeURIComponent(subject + (grade ? ' ' + grade : '')); }

  // Auth header helper: include bearer token if present in localStorage
  function getAuthHeaders(){
    const token = localStorage.getItem('fp_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  }

  async function fetchFilesForDrive(rootId, classValue, subject){
    // calls server proxy /api/drive-files
    const q = new URLSearchParams();
    if(rootId) q.set('root', rootId);
    if(classValue) q.set('class', classValue);
    if(subject) q.set('subject', subject);
    const url = '/api/drive-files?' + q.toString();
    const headers = Object.assign({ 'Accept': 'application/json' }, getAuthHeaders());
    const r = await fetch(url, { headers, credentials: 'same-origin' });
    if(!r.ok){
      const txt = await r.text().catch(()=>'');
      throw new Error(`HTTP ${r.status} ${r.statusText}: ${txt}`);
    }
    return r.json();
  }

  function renderDriveFiles(files){
    // returns DOM node
    const wrap = document.createElement('div');
    wrap.className = 'drive-files';
    if(!files || !files.length){
      const none = document.createElement('div'); none.className = 'muted'; none.textContent = 'Không có tài liệu trong Drive.';
      wrap.appendChild(none);
      return wrap;
    }
    // Open all button
    if(files.length > 1){
      const tools = document.createElement('div'); tools.style.marginBottom = '8px';
      const openAll = document.createElement('button'); openAll.className = 'btn'; openAll.textContent = 'Mở tất cả';
      openAll.addEventListener('click', () => {
        files.forEach(f => {
          const link = f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`;
          window.open(link, '_blank');
        });
      });
      tools.appendChild(openAll);
      wrap.appendChild(tools);
    }
    files.forEach(f => {
      const item = document.createElement('div'); item.className = 'file-item';
      const left = document.createElement('div');
      left.innerHTML = `<strong>${escapeHtml(f.name || 'Không tên')}</strong><div class="muted" style="font-size:12px">${escapeHtml(f.mimeType||'')}</div>`;
      const right = document.createElement('div');
      const viewBtn = document.createElement('button'); viewBtn.className = 'btn primary'; viewBtn.textContent = 'Xem';
      viewBtn.addEventListener('click', () => {
        const root = encodeURIComponent(document.getElementById('ROOT_ID') && document.getElementById('ROOT_ID').value ? document.getElementById('ROOT_ID').value : '');
        const klass = encodeURIComponent((document.querySelector('.menu-class .menu-item.active') || {}).dataset?.class || '');
        const url = `/drive-reader.html?root=${root}&class=${klass}&subject=${encodeURIComponent(f.name||'')}&file=${encodeURIComponent(f.id)}`;
        window.open(url, '_blank');
      });
      const dl = document.createElement('a'); dl.className = 'btn-ghost'; dl.textContent = 'Tải về';
      dl.href = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(f.id)}`; dl.target = '_blank';
      right.appendChild(viewBtn); right.appendChild(dl);
      item.appendChild(left); item.appendChild(right);
      wrap.appendChild(item);
    });
    return wrap;
  }

  function showSubjectDetail(subject, grade){
    if(!detailWrap) return;
    detailTitle.textContent = subject;
    detailDesc.textContent = `Tài liệu tham khảo và liên kết cho ${subject}${grade ? ' (Lớp ' + grade + ')' : ''}.`;
    detailBooks.innerHTML = '';

    // 1) try to fetch Drive files (best-effort). If it fails, still show books links.
    const rootIdEl = document.getElementById('ROOT_ID');
    const rootId = rootIdEl && rootIdEl.value ? rootIdEl.value.trim() : '';
    fetchFilesForDrive(rootId, grade, subject).then(json => {
      if(json && Array.isArray(json.files) && json.files.length){
        const filesNode = renderDriveFiles(json.files);
        detailBooks.appendChild(filesNode);
      }
    }).catch(err => {
      // silently ignore drive errors, but log
      console.debug('fetchFilesForDrive error', err);
    }).finally(() => {
      // Always render textbook links (below files)
      const resources = getResourcesFor(subject, grade);
      if(resources && resources.length){
        const ul = document.createElement('ul'); ul.className = 'resource-list';
        resources.forEach(r => {
          const li = document.createElement('li');
          const a = document.createElement('a'); a.href = r.url; a.textContent = r.label || r.url;
          a.target = '_blank'; a.rel = 'noopener noreferrer';
          li.appendChild(a); ul.appendChild(li);
        });
        detailBooks.appendChild(ul);
      } else {
        const a = document.createElement('a');
        a.className = 'book-link';
        a.href = hoc10Search(subject, grade);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = `Tìm sách trên hoc10 cho ${subject}${grade ? ' — Lớp ' + grade : ''}`;
        detailBooks.appendChild(a);
      }
    });

    detailWrap.style.display = 'block';
    try{ detailWrap.scrollIntoView({ behavior:'smooth', block:'start' }); } catch(e){}
  }

  // --- Delegation for subject clicks ---
  function installSubjectDelegation(){
    const container = document.querySelector('.subjects-view') || document.body;
    if(container._delegationInstalled) return;
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
    container._delegationInstalled = true;
  }

  // --- Search/autocomplete (kept from your file) ---
  const searchForm = $('.search-form');
  const inputEl = searchForm ? searchForm.querySelector('.search-input') : null;

  const dropdownId = 'searchAutocomplete';
  let dropdown = document.getElementById(dropdownId);
  if(!dropdown){ dropdown = document.createElement('div'); dropdown.id = dropdownId; dropdown.className = 'search-autocomplete hidden'; document.body.appendChild(dropdown); }
  let suggestions = [], activeIndex = -1;
  function positionDropdown(){ if(!inputEl) return; const rect = inputEl.getBoundingClientRect(); dropdown.style.left = (rect.left+window.scrollX)+'px'; dropdown.style.top=(rect.bottom+window.scrollY+6)+'px'; dropdown.style.width = Math.max(240, rect.width) + 'px'; }
  function showDropdown(items){ suggestions = items || []; activeIndex = -1; dropdown.innerHTML=''; if(!items || !items.length){ dropdown.classList.add('hidden'); return;} const ul=document.createElement('ul'); ul.className='autocomplete-list'; items.forEach((it,i)=>{ const li=document.createElement('li'); li.className='autocomplete-item'; li.innerHTML = `<div class="title">${escapeHtml(it.title||it.name)}</div><div class="meta">${escapeHtml(it.meta||'')}</div>`; li.addEventListener('click', ()=>selectSuggestion(i)); ul.appendChild(li); }); dropdown.appendChild(ul); dropdown.classList.remove('hidden'); positionDropdown(); }
  function hideDropdown(){ dropdown.classList.add('hidden'); suggestions=[]; activeIndex=-1; }
  function selectSuggestion(i){ const it = suggestions[i]; if(!it) return; if(it.url) window.location.href = it.url; else { if(inputEl) inputEl.value = it.title||it.name||''; hideDropdown(); doSearch(inputEl.value); } }
  function highlightActive(){ const items = dropdown.querySelectorAll('.autocomplete-item'); items.forEach((el,i)=> el.classList.toggle('active', i===activeIndex)); }

  if(inputEl){
    inputEl.addEventListener('input', debounce(function(e){
      const q = e.target.value || '';
      if(!q){ hideDropdown(); return; }
      const all = [];
      Object.values(classSubjects).forEach(arr => arr.forEach(s => all.push(s)));
      const filtered = [...new Set(all)].filter(s => s.toLowerCase().includes(q.toLowerCase())).slice(0,6).map(x => ({ title: x, meta: '' }));
      showDropdown(filtered);
    }, 150));
    window.addEventListener('resize', positionDropdown);
    window.addEventListener('scroll', positionDropdown);
    inputEl.addEventListener('keydown', (e)=>{
      if(dropdown.classList.contains('hidden')) return;
      const len = suggestions.length||0;
      if(e.key==='ArrowDown'){ e.preventDefault(); activeIndex=(activeIndex+1)%len; highlightActive(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); activeIndex=(activeIndex-1+len)%len; highlightActive(); }
      else if(e.key==='Enter'){ if(activeIndex>=0){ e.preventDefault(); selectSuggestion(activeIndex); } else { e.preventDefault(); doSearch(inputEl.value||''); } }
      else if(e.key==='Escape'){ hideDropdown(); }
    });
  }
  document.addEventListener('click', (e)=>{ if(!dropdown.contains(e.target) && e.target !== inputEl) hideDropdown(); });

  // --- Results (API search) ---
  const resultsContainerId='searchResultsContainer';
  let resultsContainer = document.getElementById(resultsContainerId);
  if(!resultsContainer){ resultsContainer = document.createElement('section'); resultsContainer.id = resultsContainerId; resultsContainer.className='search-results'; const mainNode=document.querySelector('main')||null; document.body.insertBefore(resultsContainer, mainNode); }
  async function doSearch(q,page=1){
    if(!q){ resultsContainer.innerHTML='<p class="no-results">Không tìm thấy kết quả.</p>'; return; }
    resultsContainer.innerHTML='<p class="loading">Đang tìm kiếm…</p>';
    try{
      const headers = Object.assign({ 'Accept': 'application/json' }, getAuthHeaders());
      const r = await fetch('/api/search?q='+encodeURIComponent(q)+'&page='+page+'&limit=10', { credentials:'include', headers });
      if(!r.ok){ resultsContainer.innerHTML=`<p class="error">Lỗi khi tìm kiếm: ${r.status} ${r.statusText}</p>`; return; }
      const data = await r.json();
      if(!data || !data.results || data.results.length===0){ resultsContainer.innerHTML='<p class="no-results">Không tìm thấy kết quả.</p>'; return; }
      let html=`<div class="results-info">Tìm thấy ${data.total||data.results.length} kết quả — Trang ${data.page||1}</div><div class="results-list">`;
      data.results.forEach(r2=>{
        const it = r2.item||r2;
        html+=`<article class="result-card"><h3 class="result-title"><a href="${escapeHtml(it.url||'#')}" target="_blank">${escapeHtml(it.title||(it.name||'(Không tiêu đề)'))}</a></h3><div class="result-meta">${escapeHtml(it.subject||'')}</div><p class="result-snippet">${escapeHtml((it.content||'').slice(0,250))}...</p></article>`;
      });
      html+='</div>';
      resultsContainer.innerHTML = html;
    } catch(err){
      resultsContainer.innerHTML=`<p class="error">Lỗi khi tìm kiếm: ${escapeHtml(err.message)}</p>`;
    }
  }

  if(searchForm) searchForm.addEventListener('submit', (e)=>{ e.preventDefault(); doSearch(inputEl? inputEl.value : new FormData(searchForm).get('q')); hideDropdown(); });

  // --- Inline login form handler (if present in page) ---
  const inlineLoginForm = $('#inlineLoginForm');
  if(inlineLoginForm){
    inlineLoginForm.addEventListener('submit', async function(e){
      e.preventDefault();
      const btn = inlineLoginForm.querySelector('button[type="submit"], input[type="submit"]');
      if(btn) btn.disabled = true;
      const fd = new FormData(inlineLoginForm);
      const payload = { username: fd.get('username'), password: fd.get('password') };
      function showInlineError(msg){ let el = inlineLoginForm.querySelector('.inline-login-error'); if(!el){ el=document.createElement('div'); el.className='inline-login-error err'; inlineLoginForm.prepend(el);} el.textContent = msg; }
      try {
        const headers = Object.assign({ 'Content-Type':'application/json','Accept':'application/json','X-Requested-With':'XMLHttpRequest' }, getAuthHeaders());
        const res = await fetch('/api/login', { method:'POST', headers, credentials:'include', body: JSON.stringify(payload) });
        if(res.redirected){ window.location.replace(res.url); return; }
        const ct = res.headers.get('content-type')||'';
        if(ct.indexOf('application/json')!==-1){
          const json = await res.json();
          if(res.ok && (json.ok || json.user || json.token)){
            try{
              const remember = !!inlineLoginForm.querySelector('input[name="remember"]:checked');
              if(json.token){
                if(remember) localStorage.setItem('fp_token', json.token);
                else sessionStorage.setItem('fp_token', json.token);
              }
            }catch(e){}
            await loadUser();
            const wrap = $('#inlineLogin'); if(wrap){ wrap.classList.add('hidden'); wrap.setAttribute('aria-hidden','true'); }
            return;
          } else { showInlineError(json.message || 'Đăng nhập thất bại'); }
        } else if(ct.indexOf('text/html')!==-1){ window.location.reload(); return; }
        else { const txt = await res.text(); showInlineError('Phản hồi không hợp lệ từ server'); console.debug('login text', txt.slice(0,200)); }
      } catch(err){ showInlineError('Lỗi mạng, thử lại sau'); }
      finally { if(btn) btn.disabled = false; }
    });
  }

  // --- Auth helpers & UI (uses /api/me and Bearer token when available) ---
  const userCard = $('#user-card');
  const userInfoEl = $('#user-info');

  function clearAuthStateClientSide(){
    try{
      ['auth_token','auth_user','token','user','fp_token','fp_user'].forEach(k=>{
        try{ localStorage.removeItem(k); }catch(){}
        try{ sessionStorage.removeItem(k); }catch(){}
      });
    }catch(e){ console.warn(e); }
  }

  function parseUserFromMeResponse(obj){
    if(!obj) return null;
    if(obj.user) return obj.user;
    if(obj.username || obj.displayName || obj.email || obj.id) return obj;
    if(obj.data && obj.data.user) return obj.data.user;
    return null;
  }

  function updateAuthUI(user){
    const authLoginLink = $('#link-login');
    const authRegisterLink = $('#link-register');
    const headerLogoutBtn = $('#btn-logout-header');
    const userCardLogoutBtn = $('#btn-logout');
    if(user){
      if(userCard) userCard.classList.remove('hidden');
      if(userInfoEl) userInfoEl.textContent = user.displayName || user.username || (user.email||'');
      if(authLoginLink) authLoginLink.style.display = 'none';
      if(authRegisterLink) authRegisterLink.style.display = 'none';
      if(headerLogoutBtn) headerLogoutBtn.style.display = '';
      if(userCardLogoutBtn) userCardLogoutBtn.style.display = '';
    } else {
      if(userCard) userCard.classList.add('hidden');
      if(userInfoEl) userInfoEl.textContent = '';
      if(authLoginLink) authLoginLink.style.display = '';
      if(authRegisterLink) authRegisterLink.style.display = '';
      if(headerLogoutBtn) headerLogoutBtn.style.display = 'none';
      if(userCardLogoutBtn) userCardLogoutBtn.style.display = 'none';
    }
  }

  async function loadUser(){
    try {
      const headers = Object.assign({}, getAuthHeaders());
      const r = await fetch('/api/me', { credentials:'include', cache:'no-store', headers });
      const ct = r.headers.get('content-type') || '';
      if(ct.indexOf('text/html') !== -1){ updateAuthUI(null); return null; }
      if(!r.ok){ updateAuthUI(null); return null; }
      const j = await r.json().catch(()=>null);
      const user = parseUserFromMeResponse(j);
      updateAuthUI(user);
      return user;
    } catch(e){ console.warn('loadUser error', e); updateAuthUI(null); return null; }
  }

  async function serverLogout(){
    try{ const r = await fetch('/logout.php',{ method:'POST', credentials:'include', headers:{ 'Accept':'application/json' } }); if(r.ok){ try{ await r.json(); }catch{}; return { ok:true, endpoint:'/logout.php' }; } }catch(e){}
    try{ const r2 = await fetch('/api/logout',{ method:'POST', credentials:'include', headers:{ 'Accept':'application/json' } }); if(r2.ok){ try{ await r2.json(); }catch{}; return { ok:true, endpoint:'/api/logout' }; } return { ok:false, endpoint:'/api/logout', status:r2.status }; }catch(e){ return { ok:false, error:e }; }
  }

  async function doLogout(){
    try {
      await serverLogout();
      clearAuthStateClientSide();
      updateAuthUI(null);
      try { const me = await fetch('/api/me',{ credentials:'include', cache:'no-store', headers: Object.assign({}, getAuthHeaders()) }); if(me.ok){ const j = await me.json().catch(()=>null); if(parseUserFromMeResponse(j)){ location.reload(); return; } } } catch(e){}
      return;
    } catch(e){ console.error('doLogout error', e); clearAuthStateClientSide(); try{ location.reload(); }catch(err){ window.location.href='/'; } }
  }

  function installLogoutButtons(){ const btns = $$('button#btn-logout, #btn-logout-header, .btn-logout'); btns.forEach(b=>{ if(b._installed) return; b.addEventListener('click', function(ev){ ev.preventDefault(); doLogout(); }, { passive:false }); b._installed = true; }); }

  // --- Init ---
  function initAuthChecks(){ loadUser(); setTimeout(()=>loadUser(), 400); window.addEventListener('focus', ()=>loadUser()); }

  document.addEventListener('DOMContentLoaded', function(){
    populateSubjects();
    installSubjectDelegation();
    installLogoutButtons();
    initAuthChecks();

    const btnTest = document.getElementById('btn-test');
    if(btnTest){ btnTest.addEventListener('click', async ()=>{ try{ const headers = Object.assign({}, getAuthHeaders()); const r = await fetch('/api/secure-test', { credentials:'include', headers }); const t = await r.text(); const apiResult = document.getElementById('api-result'); if(apiResult) apiResult.textContent = `Status ${r.status}: ${t.slice(0,250)}`; }catch(e){ console.error(e);} }); }
  });

  // Expose for debugging
  window.FP = window.FP || {};
  window.FP.populateSubjects = populateSubjects;
  window.FP.showSubjectDetail = showSubjectDetail;
  window.loadUser = loadUser;
  window.doLogout = doLogout;
  window.clearAuthStateClientSide = clearAuthStateClientSide;
  window.FP.getResourcesFor = getResourcesFor;

})();
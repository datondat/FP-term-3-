// public/index.js - đầy đủ, robust, books integration, observer guard
(function(){
  'use strict';
  window.FP = window.FP || {};

  /* ---------- Helpers ---------- */
  function log(){ try{ console.info('[FP]', ...arguments); }catch(e){} }
  function warn(){ try{ console.warn('[FP]', ...arguments); }catch(e){} }
  function esc(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]; }); }
  function token(){ try{ return localStorage.getItem('token'); }catch(e){ return null; } }

  /* ---------- Subjects (by grade) ---------- */
  const subjectsByGrade = {
    6:['Toán','Ngữ văn','Tiếng Anh','Khoa học tự nhiên','Lịch sử','Địa lí','Tin học','Công nghệ','GDCD'],
    7:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Công nghệ'],
    8:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Tin học'],
    9:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','GDQPAN'],
    10:['Toán (Tự chọn/Chuyên)','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDCD'],
    11:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDQPAN'],
    12:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','Lịch sử & Địa lí'],
    common:['Giáo dục công dân','Công nghệ','Khoa học tự nhiên','Giáo dục kinh tế và pháp luật']
  };

  /* ---------- Books map (grade|subject -> array of {label,url}) ---------- */
  const booksMap = {
    // Ngữ văn
    '6|Ngữ văn': [
      { label: 'SGK Ngữ văn 6 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-1/1/22/0/' },
      { label: 'SGK Ngữ văn 6 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-2/1/23/0/' },
      { label: 'SBT Ngữ văn 6 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-1/5/50/0/' },
      { label: 'SBT Ngữ văn 6 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-2/5/174/0/' }
    ],
    '7|Ngữ văn': [
      { label: 'SGK Ngữ văn 7 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-7-tap-1/1/139/0/' },
      { label: 'SGK Ngữ văn 7 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-7-tap-2/1/140/0/' },
      { label: 'SBT Ngữ văn 7 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-7-tap-1/5/282/0/' },
      { label: 'SBT Ngữ văn 7 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-7-tap-2/5/283/0/' }
    ],
    '8|Ngữ văn': [
      { label: 'SGK Ngữ văn 8 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-8-tap-1/1/412/0/' },
      { label: 'SGK Ngữ văn 8 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-8-tap-2/1/414/0/' },
      { label: 'SBT Ngữ văn 8 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-8-tap-1/5/422/0/' },
      { label: 'SBT Ngữ văn 8 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-8-tap-2/5/423/0/' }
    ],
    '9|Ngữ văn': [
      { label: 'SGK Ngữ văn 9 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-9-tap-1/1/697/0/' },
      { label: 'SGK Ngữ văn 9 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-9-tap-2/1/698/0/' },
      { label: 'SBT Ngữ văn 9 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-9-tap-1/5/713/0/' },
      { label: 'SBT Ngữ văn 9 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-9-tap-2/5/714/0/' }
    ],
    '10|Ngữ văn': [
      { label: 'SGK Ngữ văn 10 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-10-tap-1/1/153/0/' },
      { label: 'SGK Ngữ văn 10 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-10-tap-2/1/154/0/' },
      { label: 'Chuyên đề Ngữ văn 10', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-ngu-van-10/1/199/0/' },
      { label: 'SBT Ngữ văn 10 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-10-tap-1/5/288/0/' },
      { label: 'SBT Ngữ văn 10 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-10-tap-2/5/289/0/' }
    ],
    '11|Ngữ văn': [
      { label: 'SGK Ngữ văn 11 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-11-tap-1/1/444/0/' },
      { label: 'SGK Ngữ văn 11 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-11-tap-2/1/445/0/' },
      { label: 'Chuyên đề Ngữ văn 11', url: 'https://www.hoc10.vn/doc-sach/cd-ngu-van-11/1/395/0/' },
      { label: 'SBT Ngữ văn 11 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-11-tap-1/5/430/0/' },
      { label: 'SBT Ngữ văn 11 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-11-tap-2/5/432/0/' }
    ],
    '12|Ngữ văn': [
      { label: 'SGK Ngữ văn 12 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-12-tap-1/1/719/0/' },
      { label: 'SGK Ngữ văn 12 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-12-tap-2/1/720/0/' },
      { label: 'Chuyên đề Ngữ văn 12', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-ngu-van-12/1/740/0/' },
      { label: 'SBT Ngữ văn 12 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-12-tap-1/5/752/0/' },
      { label: 'SBT Ngữ văn 12 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-12-tap-2/5/753/0/' }
    ],

    // Toán (examples)
    '6|Toán': [
      { label: 'SGK Toán 6 - T1', url: 'https://www.hoc10.vn/doc-sach/toan-6-1/1/24/0/' },
      { label: 'SGK Toán 6 - T2', url: 'https://www.hoc10.vn/doc-sach/toan-6-2/1/35/0/' },
      { label: 'SBT Toán 6 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-6-tap-1/5/52/0/' },
      { label: 'SBT Toán 6 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-6-tap-2/5/178/0/' }
    ],

    // Tiếng Anh (examples)
    '6|Tiếng Anh': [
      { label: 'SGK Tiếng Anh 6', url: 'https://www.hoc10.vn/doc-sach/tieng-anh-6/1/30/0/' },
      { label: 'SBT Tiếng Anh 6', url: 'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-6/5/82/0/' }
    ],

    // Tin học (examples)
    '6|Tin học': [
      { label: 'SGK Tin học 6', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-6/1/28/0/' }
    ]
  };

  /* ---------- Create DOM items ---------- */
  function createSubjectItem(name, grade){
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = name;
    a.href = '#';
    a.className = 'subject';
    a.setAttribute('data-desc', `Mô tả mẫu cho môn "${name}"`);
    a.addEventListener('click', function(e){
      e.preventDefault();
      showSubjectDetail(name, grade);
    });
    li.appendChild(a);
    return li;
  }

  function populateSubjects(){
    try{
      log('populateSubjects start');
      Object.keys(subjectsByGrade).forEach(function(g){
        const el = document.getElementById('grade-' + g);
        if(!el){
          log('skip missing list', 'grade-' + g);
          return;
        }
        // populate (repopulate safely)
        el.innerHTML = '';
        (subjectsByGrade[g] || []).forEach(function(sub){
          el.appendChild(createSubjectItem(sub, g));
        });
        log('populated grade-' + g, 'count=' + el.children.length);
      });
      log('populateSubjects end');
    }catch(err){
      console.error('[FP] populateSubjects error', err);
    }
  }

  function renderBookLinks(grade, subject){
    const key = grade + '|' + subject;
    const list = booksMap[key] || [];
    const wrap = document.createElement('div');
    wrap.className = 'subject-books';
    if(list.length === 0){
      const span = document.createElement('div');
      span.className = 'muted';
      span.textContent = 'Không có tài liệu tham khảo cho môn này.';
      wrap.appendChild(span);
      return wrap;
    }
    list.forEach(function(b, idx){
      const a = document.createElement('a');
      a.href = b.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'book-link';
      a.textContent = b.label;
      wrap.appendChild(a);
      if(idx < list.length - 1){
        const sep = document.createElement('span');
        sep.style.marginRight = '6px';
        wrap.appendChild(sep);
      }
    });
    return wrap;
  }

  function showSubjectDetail(name, grade){
    const title = document.getElementById('subject-title');
    const desc = document.getElementById('subject-desc');
    const booksEl = document.getElementById('subject-books');
    const wrap = document.getElementById('subject-detail');
    if(title) title.textContent = name;
    if(desc) desc.textContent = `Mô tả mẫu cho môn "${name}".`;
    if(booksEl){
      booksEl.innerHTML = '';
      booksEl.appendChild(renderBookLinks(grade, name));
    }
    if(wrap) wrap.style.display = 'block';
    window.scrollTo({ top: wrap ? (wrap.offsetTop - 20) : 0, behavior: 'smooth' });
  }

  /* ---------- Simple auth/status helpers ---------- */
  function hideStatus(){ const s = document.getElementById('status-block'); if(s) s.classList.add('hidden'); }
  function showStatus(){ const s = document.getElementById('status-block'); if(s) s.classList.remove('hidden'); }

  function immediateUIFromToken(tkn){
    try{
      if(!tkn) return false;
      const payload = (function(tok){
        try{
          const p = tok.split('.')[1];
          let b = p.replace(/-/g,'+').replace(/_/g,'/');
          switch(b.length % 4){ case 2: b += '=='; break; case 3: b += '='; break; }
          const decoded = atob(b);
          const json = decodeURIComponent(Array.prototype.map.call(decoded, function(c){ return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
          return JSON.parse(json);
        }catch(e){ return null; }
      })(tkn);
      if(!payload) return false;
      const pseudo = { display_name: payload.display_name || payload.name || payload.username || '', username: payload.username || payload.sub || '', role: payload.role || '' };
      hideStatus();
      const uc = document.getElementById('user-card');
      if(uc){
        uc.classList.remove('hidden');
        const ui = document.getElementById('user-info');
        if(ui) ui.innerHTML = `<strong>${esc(pseudo.display_name||pseudo.username)}</strong><div class="muted">role: ${esc(pseudo.role||'')}</div>`;
      }
      return true;
    }catch(e){ return false; }
  }

  async function verifyTokenWithServer(){
    const t = token();
    if(!t){ showStatus(); return; }
    try{
      const res = await fetch('/api/auth/me', { method: 'GET', cache: 'no-store', headers: { 'Authorization': 'Bearer ' + t, 'Accept': 'application/json' }});
      if(!res.ok){ try{ localStorage.removeItem('token'); }catch(e){}; showStatus(); return; }
      const body = await res.json().catch(()=>null);
      let user = null;
      if(body && body.user) user = body.user;
      else if(body && (body.username || body.display_name || body.id || body.email)) user = body;
      if(!user){ try{ localStorage.removeItem('token'); }catch(e){}; showStatus(); return; }
      hideStatus();
      const uc = document.getElementById('user-card');
      if(uc){ uc.classList.remove('hidden'); const ui = document.getElementById('user-info'); if(ui) ui.innerHTML = `<strong>${esc(user.display_name||user.username||user.email||'')}</strong><div class="muted">role: ${esc(user.role||'')}</div>`; }
    }catch(err){
      warn('verifyTokenWithServer error', err);
    }
  }

  /* ---------- MutationObserver guard (restore lists if emptied) ---------- */
  const gradeIds = ['grade-6','grade-7','grade-8','grade-9','grade-10','grade-11','grade-12','grade-common'];
  let observers = [];
  function installObservers(){
    try{
      const cfg = { childList: true };
      gradeIds.forEach(function(id){
        const el = document.getElementById(id);
        if(!el) return;
        const obs = new MutationObserver(function(muts){
          muts.forEach(function(m){
            if(m.type === 'childList'){
              if(el.children.length === 0){
                warn('Detected empty', id, '- restoring');
                const gradeKey = id.replace('grade-','');
                const list = subjectsByGrade[gradeKey];
                if(Array.isArray(list) && list.length){
                  setTimeout(function(){
                    if(el.children.length === 0){
                      list.forEach(function(nm){ el.appendChild(createSubjectItem(nm, gradeKey)); });
                      log('restored', id, 'count=', el.children.length);
                    }
                  }, 40);
                }
              }
            }
          });
        });
        obs.observe(el, cfg);
        observers.push(obs);
        log('observer attached to', id);
      });
    }catch(e){
      warn('installObservers failed', e);
    }
  }

  /* ---------- Init ---------- */
  function init(){
    log('init start');
    populateSubjects();
    installObservers();
    const t = token();
    if(t){
      immediateUIFromToken(t);
      setTimeout(verifyTokenWithServer, 30);
    } else {
      showStatus();
    }
    log('init done');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ---------- Exports ---------- */
  window.FP.populateSubjects = populateSubjects;
  window.FP.showSubjectDetail = showSubjectDetail;
  window.FP.booksMap = booksMap;
  window.FP.verifyToken = verifyTokenWithServer;

})();
(function(){
  'use strict';
  // dữ liệu môn (giữ cùng structure với index.js cũ)
  const subjectsByGrade = {
    6:['Toán','Ngữ văn','Tiếng Anh','Khoa học tự nhiên','Lịch sử','Địa lí','Tin học','Công nghệ','GDCD'],
    7:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Công nghệ'],
    8:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Tin học'],
    9:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','GDQPAN'],
    10:['Toán (Tự chọn/Chuyên)','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDCD'],
    11:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDQPAN'],
    12:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','Lịch sử & Địa lí'],
    common:['Giáo dục công dân','Công nghệ','Khoa học tự nhiên','Giáo dục kinh tế và pháp luật']
  };

  function createItem(name, grade){
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'subject';
    a.textContent = name;
    a.setAttribute('data-desc', `Mô tả mẫu cho môn "${name}".`);
    a.addEventListener('click', function(e){
      e.preventDefault();
      const title = document.getElementById('subject-title');
      const desc = document.getElementById('subject-desc');
      const books = document.getElementById('subject-books');
      if(title) title.textContent = name;
      if(desc) desc.textContent = `Mô tả mẫu cho môn "${name}".`;
      if(books) books.innerHTML = ''; // nếu bạn sau này thêm booksMap, có thể render ở đây
      const wrap = document.getElementById('subject-detail');
      if(wrap) wrap.style.display = 'block';
    });
    li.appendChild(a);
    return li;
  }

  function populateSubjectsFallback(){
    try {
      Object.keys(subjectsByGrade).forEach(function(g){
        const ul = document.getElementById('grade-' + g);
        if(!ul) return;
        // nếu đã có phần tử thì giữ nguyên (tránh phá UI), chỉ chèn khi rỗng
        if(ul.children.length === 0){
          ul.innerHTML = '';
          (subjectsByGrade[g]||[]).forEach(name => ul.appendChild(createItem(name, g)));
        }
      });
      // expose for debug
      window.FP = window.FP || {};
      window.FP.populateSubjects = populateSubjectsFallback;
      console.info('[FP-fallback] Subjects populated (fallback).');
    } catch(err){
      console.error('[FP-fallback] populate error', err);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', populateSubjectsFallback);
  } else {
    populateSubjectsFallback();
  }
})();
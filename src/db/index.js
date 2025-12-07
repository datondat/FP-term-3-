// public/index.js - robust v4: id lookup + fallback text-search để ẩn "Bạn chưa đăng nhập"
(function(){
  'use strict';

  function parseJwt(token){
    try {
      const parts = token.split('.');
      if(parts.length !== 3) return null;
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(payload).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(json);
    } catch(e){
      return null;
    }
  }

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

  const gradeEls = {
    6: document.getElementById('grade-6'),
    7: document.getElementById('grade-7'),
    8: document.getElementById('grade-8'),
    9: document.getElementById('grade-9'),
    10: document.getElementById('grade-10'),
    11: document.getElementById('grade-11'),
    12: document.getElementById('grade-12'),
    common: document.getElementById('grade-common')
  };

  function createSubjectItem(name){
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = name;
    a.href = '#';
    a.className = 'subject';
    a.setAttribute('data-desc', `Mô tả mẫu cho môn "${name}". Nhấn để xem chi tiết.`);
    a.addEventListener('click', (e)=>{ e.preventDefault(); showSubjectDetail(name); });
    li.appendChild(a);
    return li;
  }

  function populateSubjects(){
    Object.keys(gradeEls).forEach(k=>{
      const el = gradeEls[k];
      if(!el) return;
      el.innerHTML = '';
      const list = subjectsByGrade[k] || [];
      list.forEach(s => el.appendChild(createSubjectItem(s)));
    });
  }

  function showSubjectDetail(name){
    const titleEl = document.getElementById('subject-title');
    const descEl = document.getElementById('subject-desc');
    const detailWrap = document.getElementById('subject-detail');
    if(titleEl) titleEl.textContent = name;
    if(descEl) descEl.textContent = `Mô tả mẫu cho môn "${name}". Bạn có thể liên kết môn này tới DB.`;
    if(detailWrap) detailWrap.style.display = 'block';
    if(detailWrap) window.scrollTo({ top: detailWrap.offsetTop - 20, behavior: 'smooth' });
  }

  // Helper: tìm và ẩn phần "Bạn chưa đăng nhập" nếu id không tồn tại
  function hideStatusBlockFallback(){
    const statusBlock = document.getElementById('status-block');
    if(statusBlock){
      statusBlock.classList.add('hidden');
      return true;
    }
    // fallback: tìm node chứa text "Bạn chưa đăng nhập"
    const text = 'Bạn chưa đăng nhập';
    const candidates = Array.from(document.querySelectorAll('h1,h2,h3,h4,div,span')).filter(n => (n.textContent||'').trim().includes(text));
    if(!candidates.length) return false;
    candidates.forEach(n => {
      const card = n.closest('.card') || n.parentElement;
      if(card){
        card.classList.add('hidden');
        console.info('[index.js] fallback: hid card for node', n);
      } else {
        n.style.display = 'none';
      }
    });
    return true;
  }

  // Auth UI using classList (works with .hidden {display:none!important})
  function setLoggedInUI(user){
    if(!hideStatusBlockFallback()){
      // if nothing to hide by text, try removing header-level prompt (last resort)
      const st = document.querySelector('[data-status-prompt]');
      if(st) st.classList.add('hidden');
    }
    const userCard = document.getElementById('user-card');
    if(userCard) {
      userCard.classList.remove('hidden');
      const ui = document.getElementById('user-info');
      if(ui) ui.innerHTML = `<strong>${escapeHtml(user.display_name || user.username || user.email || '')}</strong>
                             <div class="muted">role: ${escapeHtml(user.role || '')}</div>`;
    }
    const linkLogin = document.getElementById('link-login');
    const linkRegister = document.getElementById('link-register');
    const uploadQuickBtn = document.getElementById('btn-upload-quick') || document.getElementById('link-upload');
    if(linkLogin) linkLogin.style.display = 'none';
    if(linkRegister) linkRegister.style.display = 'none';
    if(uploadQuickBtn) uploadQuickBtn.style.display = '';
  }

  function setLoggedOutUI(){
    // show possible hidden status blocks
    const blocks = document.querySelectorAll('.card.hidden');
    blocks.forEach(b => {
      // only re-show ones that contain "Bạn chưa đăng nhập" to avoid revealing other hidden cards
      if((b.textContent||'').includes('Bạn chưa đăng nhập')) b.classList.remove('hidden');
    });
    const userCard = document.getElementById('user-card');
    if(userCard) userCard.classList.add('hidden');
    const linkLogin = document.getElementById('link-login');
    const linkRegister = document.getElementById('link-register');
    const uploadQuickBtn = document.getElementById('btn-upload-quick') || document.getElementById('link-upload');
    if(linkLogin) linkLogin.style.display = '';
    if(linkRegister) linkRegister.style.display = '';
    if(uploadQuickBtn) uploadQuickBtn.style.display = 'none';
  }

  function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // Immediate from token (client decode) then verify
  function token(){ return localStorage.getItem('token'); }
  function showImmediateFromToken(tkn){
    const payload = parseJwt(tkn);
    if(!payload) return false;
    const pseudoUser = {
      username: payload.username || payload.userName || payload.user || payload.sub || ('id:' + (payload.userId||payload.userID||payload.user_id||'')),
      display_name: payload.display_name || payload.name || payload.username,
      role: payload.role || payload.roles || payload.roleName || ''
    };
    setLoggedInUI(pseudoUser);
    return true;
  }

  async function verifyTokenWithServer(){
    const t = token();
    if(!t){ setLoggedOutUI(); return; }
    try{
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Authorization': 'Bearer ' + t, 'Accept': 'application/json' }
      });
      if(!res.ok){
        localStorage.removeItem('token');
        setLoggedOutUI();
        return;
      }
      const body = await res.json().catch(()=>null);
      let user = null;
      if(body && body.user) user = body.user;
      else if(body && (body.username || body.display_name || body.id || body.email)) user = body;
      if(!user){
        localStorage.removeItem('token');
        setLoggedOutUI();
        return;
      }
      setLoggedInUI(user);
    }catch(err){
      console.warn('[index.js] verifyTokenWithServer error', err);
      // keep immediate UI shown if network error
    }
  }

  // init
  (function init(){
    populateSubjects();
    const t = token();
    if(t){
      showImmediateFromToken(t);
      setTimeout(verifyTokenWithServer, 30);
    } else {
      setLoggedOutUI();
    }
  })();

  // expose
  window.FP = window.FP || {};
  window.FP.verifyToken = verifyTokenWithServer;
  window.FP.setLoggedInUI = setLoggedInUI;
  window.FP.setLoggedOutUI = setLoggedOutUI;
  window.FP.parseJwt = parseJwt;

  // small helpers (used above)
  function parseJwt(token){ try{ const p = token.split('.')[1]; const b = atob(p.replace(/-/g, '+').replace(/_/g, '/')); return JSON.parse(decodeURIComponent(escape(b))); }catch(e){ return null } }
  function escape(s){ return s; } // noop for older parseJwt; kept for compatibility

})();
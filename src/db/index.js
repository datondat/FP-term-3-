// public/index.js - cập nhật: ẩn #status-block (prompt) khi login
(function(){
  const subjectsByGrade = {
    6: ['Toán','Ngữ văn','Tiếng Anh','Khoa học tự nhiên','Lịch sử','Địa lí','Tin học','Công nghệ','GDCD'],
    7: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Công nghệ'],
    8: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Tin học'],
    9: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','GDQPAN'],
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
    for (const g of [6,7,8,9,10,11,12]){
      const list = subjectsByGrade[g] || [];
      const container = gradeEls[g];
      if(!container) continue;
      container.innerHTML = '';
      list.forEach(s => container.appendChild(createSubjectItem(s)));
    }
    if(gradeEls.common){
      gradeEls.common.innerHTML='';
      (subjectsByGrade.common || []).forEach(s => gradeEls.common.appendChild(createSubjectItem(s)));
    }
  }

  function showSubjectDetail(name){
    document.getElementById('subject-title').textContent = name;
    document.getElementById('subject-desc').textContent = `Mô tả mẫu cho môn "${name}". Bạn có thể liên kết môn này tới DB.`;
    document.getElementById('subject-detail').style.display = 'block';
    window.scrollTo({ top: document.getElementById('subject-detail').offsetTop - 20, behavior: 'smooth' });
  }

  // Auth helpers
  function token(){ return localStorage.getItem('token'); }

  const statusBlock = document.getElementById('status-block'); // <--- chỉ ẩn phần này
  const userCard = document.getElementById('user-card');
  const linkLogin = document.getElementById('link-login');
  const linkRegister = document.getElementById('link-register');
  const uploadQuickBtn = document.getElementById('btn-upload-quick') || document.getElementById('link-upload');
  const msgEl = document.getElementById('msg');
  const errEl = document.getElementById('err');

  function showMsg(t){ if(msgEl){ msgEl.style.display='block'; msgEl.textContent=t; if(errEl) errEl.style.display='none'; } }
  function showErr(t){ if(errEl){ errEl.style.display='block'; errEl.textContent=t; if(msgEl) msgEl.style.display='none'; } }
  function hideMsgs(){ if(msgEl) msgEl.style.display='none'; if(errEl) errEl.style.display='none'; }

  function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  async function fetchProfile(){
    hideMsgs();
    const t = token();
    if(!t){ setLoggedOutUI(); return; }
    try{
      const res = await fetch('/api/auth/me', { method:'GET', cache:'no-store', headers:{ 'Authorization':'Bearer ' + t, 'Accept':'application/json' }});
      if(!res.ok){ console.warn('/api/auth/me returned', res.status); setLoggedOutUI(); return; }
      const j = await res.json().catch(()=>null);
      if(!j || !j.user){ setLoggedOutUI(); return; }
      setLoggedInUI(j.user);
    }catch(e){
      console.warn('fetchProfile failed', e);
      setLoggedOutUI();
    }
  }

  function setLoggedInUI(user){
    // Ẩn chỉ phần status prompt, giữ user-card hiện
    if(statusBlock) statusBlock.style.display = 'none';
    if(userCard){
      userCard.style.display = '';
      const ui = document.getElementById('user-info');
      if(ui) ui.innerHTML = `<strong>${escapeHtml(user.display_name || user.username)}</strong><div class="muted">role: ${escapeHtml(user.role||'')}</div>`;
    }
    if(linkLogin) linkLogin.style.display='none';
    if(linkRegister) linkRegister.style.display='none';
    if(uploadQuickBtn) uploadQuickBtn.style.display='';
  }

  function setLoggedOutUI(){
    if(statusBlock) statusBlock.style.display = '';
    if(userCard) userCard.style.display = 'none';
    if(linkLogin) linkLogin.style.display='';
    if(linkRegister) linkRegister.style.display='';
    if(uploadQuickBtn) uploadQuickBtn.style.display='none';
  }

  document.getElementById('btn-logout')?.addEventListener('click', ()=>{
    localStorage.removeItem('token');
    setLoggedOutUI();
    showMsg('Đã đăng xuất.');
  });

  document.getElementById('btn-test')?.addEventListener('click', async ()=>{
    const t = token();
    if(!t){ showErr('Không có token.'); return; }
    try{
      const res = await fetch('/api/profile', { headers:{ 'Authorization':'Bearer ' + t }, cache:'no-store' });
      const j = await res.json().catch(()=>null);
      if(!res.ok){ showErr(j && j.error ? j.error : 'Lỗi'); return; }
      document.getElementById('api-result').textContent = JSON.stringify(j, null, 2);
    }catch(e){ showErr('Lỗi kết nối: '+ e.message); }
  });

  // init
  (function init(){ populateSubjects(); fetchProfile(); })();

  window.FP = { populateSubjects, fetchProfile, setLoggedInUI, setLoggedOutUI };

})();
// public/admin.js
// Admin UI controller with grade/subject select and Drive-aware upload.

(function(){
  // helpers
  function qs(sel, ctx=document) { return ctx.querySelector(sel); }
  function qsa(sel, ctx=document) { return Array.from(ctx.querySelectorAll(sel)); }
  function el(tag, attrs={}, txt='') { const e=document.createElement(tag); for(const k in attrs) e.setAttribute(k, attrs[k]); if(txt) e.textContent=txt; return e; }
  function api(path, opts={}) {
    const full = /^https?:\/\//.test(path) ? path : (path.charAt(0) === '/' ? path : '/' + path);
    const merged = Object.assign({}, opts, { credentials: 'include' });
    return fetch(full, merged);
  }
  function showError(target, msg) { if(!target) return; target.innerHTML = `<div class="note" style="color:${'#a00'}">Lỗi: ${String(msg)}</div>`; }

  // panel switching
  const navItems = qsa('.nav-item');
  navItems.forEach(item => item.addEventListener('click', (ev) => {
    navItems.forEach(n=>n.classList.remove('active'));
    item.classList.add('active');
    const panel = item.dataset.panel;
    qsa('.panel').forEach(p => p.classList.remove('active'));
    const sel = document.getElementById('panel-' + panel);
    if (sel) sel.classList.add('active');
    // on show, refresh that panel's data
    if (panel === 'uploads') loadUploads();
    if (panel === 'comments') loadComments();
    if (panel === 'users') loadUsers();
  }));

  // logout link
  const logoutLink = document.getElementById('link-logout');
  logoutLink && logoutLink.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!confirm('Bạn muốn đăng xuất?')) return;
    try {
      const r = await api('/api/logout', { method: 'POST' });
      if (r.ok) {
        // redirect to homepage
        window.location.href = '/';
      } else {
        const text = await r.text().catch(()=>null);
        alert('Đăng xuất thất bại: ' + (text || r.status));
      }
    } catch (err) {
      alert('Lỗi mạng khi đăng xuất');
    }
  });

  // Ensure admin only: check /api/me
  (async function checkAdmin(){
    try {
      const r = await api('/api/me', { method: 'GET' });
      const txt = await r.text().catch(()=>null);
      let j = null;
      try { j = txt ? JSON.parse(txt) : null; } catch(e) { j = null; }
      if (!(r.ok && j && j.ok && j.user && j.user.role === 'admin')) {
        // not admin -> redirect to home
        window.location.href = '/';
      }
    } catch (e) {
      // if anything wrong, redirect away
      window.location.href = '/';
    }
  })();

  /* ========== Uploads ========== */
  const uploadForm = qs('#uploadForm');
  const uploadInput = qs('#uploadInput');
  const uploadsList = qs('#uploadsList');
  const refreshUploadsBtn = qs('#refreshUploads');
  const gradeSelect = qs('#gradeSelect');
  const subjectSelect = qs('#subjectSelect');

  const SUBJECTS_BY_GRADE = {
    6: ['Toán','Ngữ văn','Tiếng Anh','Tin học'],
    7: ['Toán','Ngữ văn','Tiếng Anh','Tin học'],
    8: ['Toán','Ngữ văn','Tiếng Anh','Tin học'],
    9: ['Toán','Ngữ văn','Tiếng Anh','Tin học'],
    10: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học'],
    11: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học'],
    12: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học']
  };

  function populateSubjectsForGrade(g) {
    subjectSelect.innerHTML = '<option value="">Môn</option>';
    if (!g) return;
    const arr = SUBJECTS_BY_GRADE[g] || [];
    arr.forEach(s => {
      const o = document.createElement('option'); o.value = s; o.textContent = s; subjectSelect.appendChild(o);
    });
  }
  gradeSelect && gradeSelect.addEventListener('change', ()=> populateSubjectsForGrade(gradeSelect.value));

  async function loadUploads(){
    if (!uploadsList) return;
    uploadsList.innerHTML = 'Đang tải...';
    try {
      const r = await api('/api/admin/uploads', { method: 'GET' });
      const txt = await r.text().catch(()=>null);
      let json = null; try { json = txt ? JSON.parse(txt) : null; } catch(e){ json = null; }
      if (!r.ok || !json) {
        showError(uploadsList, `Không thể tải uploads (status ${r.status}). Response bắt đầu: ${String((txt||'')).slice(0,500)}`);
        return;
      }
      if (!Array.isArray(json.uploads) || json.uploads.length === 0) {
        uploadsList.innerHTML = '<div class="muted">Chưa có file nào uploaded.</div>';
        return;
      }
      const table = el('table'); const thead = el('thead'); const tbody = el('tbody');
      thead.innerHTML = '<tr><th>Tên file</th><th>Loại</th><th>Kích thước</th><th>Ngày</th><th>Hành động</th></tr>';
      json.uploads.forEach(f => {
        const tr = el('tr');
        const name = el('td');
        // if path is drive:ID show Drive label; otherwise link to local /uploads path
        if (f.path && typeof f.path === 'string' && f.path.startsWith('drive:')) {
          const fileId = f.path.slice('drive:'.length);
          name.innerHTML = `<a href="/file.html?id=${encodeURIComponent(fileId)}" target="_blank" rel="noopener">${escapeHtml(f.original_name || f.filename)}</a> <span class="muted">(Drive)</span>`;
        } else {
          const href = f.path ? f.path : (`/file.html?id=${encodeURIComponent(f.id)}`);
          name.innerHTML = `<a href="${href}" target="_blank" rel="noopener">${escapeHtml(f.original_name || f.filename)}</a>`;
        }
        const mime = el('td', {}, f.mimetype || '-');
        const size = el('td', {}, f.size ? `${Math.round(f.size/1024)} KB` : '-');
        const date = el('td', {}, f.created_at ? (new Date(f.created_at)).toLocaleString() : '-');
        const actions = el('td'); actions.className = 'actions';
        const del = el('button'); del.className = 'danger'; del.textContent = 'Xoá';
        del.addEventListener('click', async () => {
          if (!confirm('Xác nhận xoá file này?')) return;
          try {
            const rr = await api(`/api/admin/uploads/${encodeURIComponent(f.id)}`, { method: 'DELETE' });
            if (rr.ok) { loadUploads(); } else {
              const t = await rr.text().catch(()=>null);
              alert('Xoá thất bại: ' + (t||rr.status));
            }
          } catch (er) { alert('Lỗi mạng khi xoá'); }
        });
        actions.appendChild(del);
        tr.appendChild(name); tr.appendChild(mime); tr.appendChild(size); tr.appendChild(date); tr.appendChild(actions);
        tbody.appendChild(tr);
      });
      table.appendChild(thead); table.appendChild(tbody);
      uploadsList.innerHTML = '';
      uploadsList.appendChild(table);
    } catch (err) {
      showError(uploadsList, 'Lỗi khi lấy uploads: ' + String(err));
    }
  }

  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!uploadInput || !uploadInput.files || uploadInput.files.length === 0) { alert('Chọn file trước khi upload'); return; }
      const fd = new FormData();
      fd.append('file', uploadInput.files[0]);
      const grade = gradeSelect ? gradeSelect.value : '';
      const subject = subjectSelect ? subjectSelect.value : '';
      if (grade) fd.append('grade', grade);
      if (subject) fd.append('subject', subject);
      uploadsList.innerHTML = '<div class="muted">Đang upload...</div>';
      try {
        const r = await api('/api/admin/uploads', { method: 'POST', body: fd });
        const txt = await r.text().catch(()=>null);
        let j = null; try { j = txt ? JSON.parse(txt) : null; } catch(e){ j = null; }
        if (r.ok && j && j.ok) {
          uploadInput.value = '';
          // show success then reload list
          alert('Upload thành công');
          loadUploads();
        } else {
          alert('Upload thất bại: ' + ((j && (j.error||j.message)) ? (j.error||j.message) : (txt || r.status)));
          loadUploads();
        }
      } catch (err) {
        alert('Lỗi khi upload: ' + String(err));
        loadUploads();
      }
    });
  }
  refreshUploadsBtn && refreshUploadsBtn.addEventListener('click', loadUploads);

  /* ========== Comments ========== */
  const commentsList = qs('#commentsList');
  const approveSelectedBtn = qs('#approveSelected');
  const hideSelectedBtn = qs('#hideSelected');
  const refreshCommentsBtn = qs('#refreshComments');

  async function loadComments(){
    if (!commentsList) return;
    commentsList.innerHTML = 'Đang tải...';
    try {
      const r = await api('/api/admin/comments', { method: 'GET' });
      const txt = await r.text().catch(()=>null);
      let json = null; try { json = txt ? JSON.parse(txt) : null; } catch(e){ json = null; }
      if (!r.ok || !json) {
        showError(commentsList, `Không thể tải comments (status ${r.status}). Response bắt đầu: ${String((txt||'')).slice(0,500)}`);
        return;
      }
      if (!Array.isArray(json.comments) || json.comments.length === 0) {
        commentsList.innerHTML = '<div class="muted">Không có bình luận.</div>'; return;
      }
      const table = el('table'); const thead = el('thead'); const tbody = el('tbody');
      thead.innerHTML = '<tr><th><input id="selectAll" type="checkbox" /></th><th>Người</th><th>Nội dung</th><th>Ngày</th><th>Trạng thái</th><th>Hành động</th></tr>';
      json.comments.forEach(c => {
        const tr = el('tr');
        const chkTd = el('td'); const chk = el('input'); chk.type='checkbox'; chk.className='comment-chk'; chk.value = c.id; chkTd.appendChild(chk);
        tr.appendChild(chkTd);
        tr.appendChild(el('td',{}, c.username || c.user_id || ''));
        tr.appendChild(el('td',{}, c.content || ''));
        tr.appendChild(el('td',{}, c.created_at ? (new Date(c.created_at)).toLocaleString() : ''));
        tr.appendChild(el('td',{}, c.approved ? 'Đã hiển thị' : 'Đang ẩn'));
        const actions = el('td'); actions.className='actions';
        const approve = el('button'); approve.className='btn ghost'; approve.textContent = c.approved ? 'Ẩn' : 'Hiện';
        approve.addEventListener('click', async () => {
          const newVal = !c.approved;
          try {
            const rr = await api(`/api/admin/comments/${encodeURIComponent(c.id)}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ approved: newVal }) });
            if (rr.ok) loadComments(); else { const t=await rr.text().catch(()=>null); alert('Thất bại: '+(t||rr.status)); }
          } catch(e){ alert('Lỗi mạng'); }
        });
        const del = el('button'); del.className='danger'; del.textContent='Xoá';
        del.addEventListener('click', async () => {
          if (!confirm('Xoá bình luận?')) return;
          try {
            const rr = await api(`/api/admin/comments/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
            if (rr.ok) loadComments(); else { const t=await rr.text().catch(()=>null); alert('Thất bại: '+(t||rr.status)); }
          } catch(e){ alert('Lỗi mạng'); }
        });
        actions.appendChild(approve); actions.appendChild(del);
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });
      table.appendChild(thead); table.appendChild(tbody);
      commentsList.innerHTML = ''; commentsList.appendChild(table);

      // select all checkbox
      const selectAll = qs('#selectAll');
      if (selectAll) {
        selectAll.addEventListener('change', (ev) => {
          qsa('.comment-chk').forEach(cb => cb.checked = !!ev.target.checked);
        });
      }
    } catch (err) {
      showError(commentsList, 'Lỗi khi lấy comments: ' + String(err));
    }
  }

  approveSelectedBtn && approveSelectedBtn.addEventListener('click', async () => {
    const ids = qsa('.comment-chk').filter(c=>c.checked).map(c=>parseInt(c.value,10)).filter(Boolean);
    if (!ids.length) { alert('Chọn ít nhất 1 bình luận'); return; }
    if (!confirm(`Hiện ${ids.length} bình luận?`)) return;
    try {
      const rr = await api('/api/admin/comments', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ids, approved: true }) });
      if (rr.ok) loadComments(); else { const t=await rr.text().catch(()=>null); alert('Thất bại: '+(t||rr.status)); }
    } catch(e){ alert('Lỗi mạng'); }
  });

  hideSelectedBtn && hideSelectedBtn.addEventListener('click', async () => {
    const ids = qsa('.comment-chk').filter(c=>c.checked).map(c=>parseInt(c.value,10)).filter(Boolean);
    if (!ids.length) { alert('Chọn ít nhất 1 bình luận'); return; }
    if (!confirm(`Ẩn ${ids.length} bình luận?`)) return;
    try {
      const rr = await api('/api/admin/comments', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ids, approved: false }) });
      if (rr.ok) loadComments(); else { const t=await rr.text().catch(()=>null); alert('Thất bại: '+(t||rr.status)); }
    } catch(e){ alert('Lỗi mạng'); }
  });

  refreshCommentsBtn && refreshCommentsBtn.addEventListener('click', loadComments);

  /* ========== Users ========== */
  const usersList = qs('#usersList');
  const refreshUsersBtn = qs('#refreshUsers');

  async function loadUsers(){
    if (!usersList) return;
    usersList.innerHTML = 'Đang tải...';
    try {
      const r = await api('/api/admin/users', { method: 'GET' });
      const txt = await r.text().catch(()=>null);
      let json = null; try { json = txt ? JSON.parse(txt) : null; } catch(e){ json = null; }
      if (!r.ok || !json) {
        showError(usersList, `Không thể tải users (status ${r.status}). Response bắt đầu: ${String((txt||'')).slice(0,500)}`);
        return;
      }
      if (!Array.isArray(json.users) || json.users.length === 0) {
        usersList.innerHTML = '<div class="muted">Chưa có người dùng.</div>'; return;
      }
      const table = el('table'); const thead = el('thead'); const tbody = el('tbody');
      thead.innerHTML = '<tr><th>Tên</th><th>Email</th><th>Quyền</th><th>Hành động</th></tr>';
      json.users.forEach(u => {
        const tr = el('tr');
        tr.appendChild(el('td',{}, u.name || u.username || ''));
        tr.appendChild(el('td',{}, u.email || ''));
        tr.appendChild(el('td',{}, u.role || ''));
        const actions = el('td'); actions.className='actions';
        const promote = el('button'); promote.className='btn ghost'; promote.textContent='Đặt Admin';
        promote.addEventListener('click', async () => {
          if (!confirm('Đặt người này làm admin?')) return;
          try {
            const rr = await api(`/api/admin/users/${encodeURIComponent(u.id)}/role`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ role:'admin' }) });
            if (rr.ok) loadUsers(); else { const t=await rr.text().catch(()=>null); alert('Thất bại: '+(t||rr.status)); }
          } catch(e){ alert('Lỗi mạng'); }
        });
        const del = el('button'); del.className='danger'; del.textContent='Xoá';
        del.addEventListener('click', async () => {
          if (!confirm('Xoá người dùng?')) return;
          try {
            const rr = await api(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: 'DELETE' });
            if (rr.ok) loadUsers(); else { const t=await rr.text().catch(()=>null); alert('Thất bại: '+(t||rr.status)); }
          } catch(e){ alert('Lỗi mạng'); }
        });
        actions.appendChild(promote); actions.appendChild(del);
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });
      table.appendChild(thead); table.appendChild(tbody);
      usersList.innerHTML = ''; usersList.appendChild(table);
    } catch (err) {
      showError(usersList, 'Lỗi khi lấy users: ' + String(err));
    }
  }

  refreshUsersBtn && refreshUsersBtn.addEventListener('click', loadUsers);

  // initial load for active panel (uploads)
  loadUploads();

  // expose functions for debugging
  window.__admin = { loadUploads, loadComments, loadUsers };

  // utility for escaping HTML used above
  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]);
    });
  }

})();
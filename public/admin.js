// public/admin.js
// Simple admin UI controller. Expects API endpoints under /api/admin or /api:
// - GET /api/admin/uploads
// - POST /api/admin/uploads (multipart/form-data)
// - GET /api/admin/comments
// - POST /api/admin/comments/:id/approve
// - DELETE /api/admin/comments/:id
// - GET /api/admin/users
// - POST /api/admin/users/:id/role
// - DELETE /api/admin/users/:id
// All requests use credentials: 'include' so session cookie is sent.

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

  async function loadUploads(){
    if (!uploadsList) return;
    uploadsList.innerHTML = 'Đang tải...';
    try {
      const r = await api('/api/admin/uploads', { method: 'GET' });
      const txt = await r.text().catch(()=>null);
      let json = null;
      try { json = txt ? JSON.parse(txt) : null; } catch(e){ json = null; }
      if (!r.ok || !json) {
        showError(uploadsList, `Không thể tải uploads (status ${r.status}). Response bắt đầu: ${String((txt||'')).slice(0,200)}`);
        return;
      }
      if (!Array.isArray(json.uploads)) json.uploads = [];
      // render table
      if (json.uploads.length === 0) {
        uploadsList.innerHTML = '<div class="muted">Chưa có file nào uploaded.</div>';
        return;
      }
      const table = el('table'); const thead = el('thead'); const tbody = el('tbody');
      thead.innerHTML = '<tr><th>Tên file</th><th>Kích thước</th><th>Ngày</th><th>Hành động</th></tr>';
      json.uploads.forEach(f => {
        const tr = el('tr');
        const name = el('td'); name.innerHTML = `<a href="/file.html?id=${encodeURIComponent(f.id)}" target="_blank" rel="noopener">${f.name || f.filename}</a>`;
        const size = el('td', {}, f.size ? `${Math.round(f.size/1024)} KB` : '-');
        const date = el('td', {}, f.createdAt ? (new Date(f.createdAt)).toLocaleString() : '-');
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
        tr.appendChild(name); tr.appendChild(size); tr.appendChild(date); tr.appendChild(actions);
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
      uploadsList.innerHTML = '<div class="muted">Đang upload...</div>';
      try {
        const r = await api('/api/admin/uploads', { method: 'POST', body: fd });
        const txt = await r.text().catch(()=>null);
        let j = null; try { j = txt ? JSON.parse(txt) : null; } catch(e){ j = null; }
        if (r.ok) {
          uploadInput.value = '';
          loadUploads();
        } else {
          alert('Upload thất bại: ' + (j && (j.error||j.message) ? (j.error||j.message) : (txt || r.status)));
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
  async function loadComments(){
    if (!commentsList) return;
    commentsList.innerHTML = 'Đang tải...';
    try {
      const r = await api('/api/admin/comments', { method: 'GET' });
      const txt = await r.text().catch(()=>null);
      let json = null; try { json = txt ? JSON.parse(txt) : null; } catch(e){ json = null; }
      if (!r.ok || !json) {
        showError(commentsList, `Không thể tải comments (status ${r.status}). Response bắt đầu: ${String((txt||'')).slice(0,200)}`);
        return;
      }
      if (!Array.isArray(json.comments) || json.comments.length === 0) {
        commentsList.innerHTML = '<div class="muted">Không có bình luận.</div>'; return;
      }
      const table = el('table'); const thead = el('thead'); const tbody = el('tbody');
      thead.innerHTML = '<tr><th>Người</th><th>Nội dung</th><th>Ngày</th><th>Hành động</th></tr>';
      json.comments.forEach(c => {
        const tr = el('tr');
        tr.appendChild(el('td',{}, c.author || ''));
        tr.appendChild(el('td',{}, c.content || ''));
        tr.appendChild(el('td',{}, c.createdAt ? (new Date(c.createdAt)).toLocaleString() : ''));
        const actions = el('td'); actions.className = 'actions';
        const approve = el('button'); approve.className='btn ghost'; approve.textContent='Duyệt';
        approve.addEventListener('click', async () => {
          try {
            const rr = await api(`/api/admin/comments/${encodeURIComponent(c.id)}/approve`, { method: 'POST' });
            if (rr.ok) loadComments(); else {
              const t = await rr.text().catch(()=>null); alert('Thất bại: ' + (t||rr.status));
            }
          } catch(e){ alert('Lỗi mạng'); }
        });
        const del = el('button'); del.className='danger'; del.textContent='Xoá';
        del.addEventListener('click', async () => {
          if (!confirm('Xoá bình luận?')) return;
          try {
            const rr = await api(`/api/admin/comments/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
            if (rr.ok) loadComments(); else {
              const t = await rr.text().catch(()=>null); alert('Thất bại: ' + (t||rr.status));
            }
          } catch(e){ alert('Lỗi mạng'); }
        });
        actions.appendChild(approve); actions.appendChild(del);
        tr.appendChild(actions);
        tbody.appendChild(tr);
      });
      table.appendChild(thead); table.appendChild(tbody);
      commentsList.innerHTML = ''; commentsList.appendChild(table);
    } catch (err) {
      showError(commentsList, 'Lỗi khi lấy comments: ' + String(err));
    }
  }

  /* ========== Users ========== */
  const usersList = qs('#usersList');
  async function loadUsers(){
    if (!usersList) return;
    usersList.innerHTML = 'Đang tải...';
    try {
      const r = await api('/api/admin/users', { method: 'GET' });
      const txt = await r.text().catch(()=>null);
      let json = null; try { json = txt ? JSON.parse(txt) : null; } catch(e){ json = null; }
      if (!r.ok || !json) {
        showError(usersList, `Không thể tải users (status ${r.status}). Response bắt đầu: ${String((txt||'')).slice(0,200)}`);
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

  // initial load for active panel (uploads)
  loadUploads();

  // expose functions for debugging
  window.__admin = { loadUploads, loadComments, loadUsers };

})();
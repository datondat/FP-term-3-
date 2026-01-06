// public/admin.js
// Admin UI JS: upload files and manage comments
(async function(){
  // Basic helper
  function el(id){ return document.getElementById(id); }
  function escapeHtml(s) { if (!s) return ''; return String(s).replace(/[&<>"']/g, function (m) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); }); }
  async function api(url, opts = {}) {
    opts = Object.assign({ credentials: 'include' }, opts);
    try {
      const r = await fetch(url, opts);
      const text = await r.text().catch(()=>null);
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch(e) { json = null; }
      return { ok: r.ok, status: r.status, json, text };
    } catch (e) { return { ok: false, error: e }; }
  }

  // Check admin access
  const me = await api('/api/me', { method: 'GET' });
  if (!me.ok || !me.json || !me.json.ok || !me.json.user) {
    alert('Bạn chưa đăng nhập. Vui lòng đăng nhập bằng tài khoản admin.');
    window.location.href = '/login.html';
    return;
  }

  const uploadForm = el('admin-upload-form');
  const uploadResult = el('upload-result');
  const uploadsList = el('uploads-list');
  const commentsList = el('comments-list');

  uploadForm.addEventListener('submit', async function(e){
    e.preventDefault();
    uploadResult.textContent = 'Đang upload...';
    const fileInput = el('admin-file');
    if (!fileInput.files || !fileInput.files.length) { uploadResult.textContent = 'Chưa chọn file'; return; }
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    try {
      const r = await fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'include' });
      const txt = await r.text().catch(()=>null);
      let json = null;
      try { json = txt ? JSON.parse(txt) : null; } catch(e){ json = null; }
      if (r.ok && json && json.ok) {
        uploadResult.textContent = 'Upload thành công: ' + (json.file && json.file.original_name);
        fileInput.value = '';
        await loadUploads();
      } else {
        uploadResult.textContent = 'Upload thất bại: ' + (json && json.error ? json.error : txt || 'server error');
      }
    } catch (err) {
      uploadResult.textContent = 'Upload thất bại: ' + (err && err.message ? err.message : String(err));
    }
  });

  async function loadUploads(){
    uploadsList.innerHTML = 'Đang tải...';
    const r = await api('/api/admin/uploads', { method: 'GET' });
    if (r.ok && r.json && r.json.ok) {
      const arr = r.json.uploads || [];
      if (!arr.length) { uploadsList.innerHTML = '<div class="muted">Chưa có file nào</div>'; return; }
      const t = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>#</th><th>Original name</th><th>Path</th><th>MIME</th><th>Size</th><th>Uploaded by</th><th>At</th></tr>';
      t.appendChild(thead);
      const tb = document.createElement('tbody');
      arr.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${u.id}</td>
                        <td>${escapeHtml(u.original_name)}</td>
                        <td><a href="${u.path}" target="_blank">${u.path}</a></td>
                        <td>${u.mimetype || ''}</td>
                        <td>${u.size || ''}</td>
                        <td>${u.uploaded_by || ''}</td>
                        <td>${u.created_at || ''}</td>`;
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      uploadsList.innerHTML = '';
      uploadsList.appendChild(t);
    } else {
      uploadsList.innerHTML = 'Không thể tải uploads: ' + (r.json && r.json.error ? r.json.error : JSON.stringify(r));
    }
  }

  async function loadComments(){
    commentsList.innerHTML = 'Đang tải...';
    const r = await api('/api/admin/comments', { method: 'GET' });
    if (r.ok && r.json && r.json.ok) {
      const arr = r.json.comments || [];
      if (!arr.length) { commentsList.innerHTML = '<div class="muted">Chưa có bình luận</div>'; return; }
      const t = document.createElement('table');
      t.innerHTML = '<thead><tr><th>#</th><th>User</th><th>Content</th><th>Approved</th><th>At</th><th>Actions</th></tr></thead>';
      const tb = document.createElement('tbody');
      arr.forEach(c => {
        const tr = document.createElement('tr');
        const approvedText = c.approved ? 'Yes' : 'No';
        tr.innerHTML = `<td>${c.id}</td>
                        <td>${escapeHtml(c.username || String(c.user_id || ''))}</td>
                        <td>${escapeHtml(c.content || '')}</td>
                        <td>${approvedText}</td>
                        <td>${c.created_at || ''}</td>
                        <td></td>`;
        const actionsTd = tr.querySelector('td:last-child');
        const approveBtn = document.createElement('button');
        approveBtn.className = 'btn';
        approveBtn.textContent = c.approved ? 'Unapprove' : 'Approve';
        approveBtn.addEventListener('click', async () => {
          const r2 = await api('/api/admin/comments/' + c.id, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ approved: !c.approved }) });
          if (r2.ok && r2.json && r2.json.ok) await loadComments();
          else alert('Thao tác thất bại');
        });
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', async () => {
          if (!confirm('Xoá bình luận?')) return;
          const r3 = await api('/api/admin/comments/' + c.id, { method: 'DELETE' });
          if (r3.ok && r3.json && r3.json.ok) await loadComments();
          else alert('Xoá thất bại');
        });
        actionsTd.appendChild(approveBtn);
        actionsTd.appendChild(document.createTextNode(' '));
        actionsTd.appendChild(delBtn);
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      commentsList.innerHTML = '';
      commentsList.appendChild(t);
    } else {
      commentsList.innerHTML = 'Không thể tải comments: ' + (r.json && r.json.error ? r.json.error : JSON.stringify(r));
    }
  }

  // initial loads
  await loadUploads();
  await loadComments();

})();
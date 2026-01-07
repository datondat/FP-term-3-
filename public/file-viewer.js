// public/file-viewer.js
// Logic để nhúng/hiển thị tài liệu trên trang file.html?id=...&name=...
// - Uses fetch(..., { credentials: 'include' }) so server session/cookie are sent
// - Improved comment posting UX and clearer error handling

(function () {
  function qs(name) {
    try { return (new URL(window.location.href)).searchParams.get(name); } catch (e) { return null; }
  }
  function safeText(s){ return String(s || '').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // fetch wrapper including cookies for same-origin session-based auth
  function apiFetch(path, opts = {}) {
    const merged = Object.assign({ credentials: 'include' }, opts || {});
    return fetch(path, merged);
  }

  // ensure login/register links include ?next=currentPage so server redirects back after login
  function ensureAuthLinks() {
    try {
      const next = window.location.pathname + window.location.search + window.location.hash;
      const login = document.getElementById('link-login');
      if (login) {
        try {
          const u = new URL(login.getAttribute('href') || login.href, location.origin);
          u.searchParams.set('next', next);
          login.href = u.toString();
        } catch(e) {}
      }
      const reg = document.getElementById('link-register');
      if (reg) {
        try {
          const u2 = new URL(reg.getAttribute('href') || reg.href, location.origin);
          u2.searchParams.set('next', next);
          reg.href = u2.toString();
        } catch(e) {}
      }
    } catch (e) {
      console.warn('ensureAuthLinks error', e);
    }
  }

  const id = qs('id');
  const fileName = qs('name') || '';
  const viewerWrapper = document.getElementById('viewer-wrapper');
  const titleEl = document.getElementById('file-title');
  const metaEl = document.getElementById('file-meta');
  const rawLink = document.getElementById('raw-link');
  const downloadLink = document.getElementById('download-link');

  titleEl.textContent = fileName || 'Tài liệu';
  metaEl.textContent = id ? ('ID: ' + id) : '';

  if (!id) {
    if (viewerWrapper) viewerWrapper.innerHTML = '<div style="padding:18px;color:#900;">Thiếu tham số id. Ví dụ: /file.html?id=FILE_ID</div>';
    if (rawLink) rawLink.style.display = 'none';
    if (downloadLink) downloadLink.style.display = 'none';
    ensureAuthLinks();
    return;
  }

  const API_BASE = (window.API_BASE === undefined) ? '' : (window.API_BASE || '');
  function apiPath(p){
    if (!p.startsWith('/')) p = '/' + p;
    return API_BASE ? API_BASE.replace(/\/$/, '') + p : p;
  }

  const fileUrl = apiPath(`/api/drive/file/${encodeURIComponent(id)}`);

  // Set controls
  if (rawLink) rawLink.href = fileUrl;
  if (downloadLink) {
    downloadLink.href = fileUrl;
    downloadLink.setAttribute('download', fileName || '');
  }

  // Create iframe element for embedding
  function createIframe(url) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.loading = 'eager';
    return iframe;
  }

  // Try embedding via iframe first
  try {
    if (viewerWrapper) viewerWrapper.innerHTML = '';
    const iframe = createIframe(fileUrl);
    if (viewerWrapper) viewerWrapper.appendChild(iframe);

    // After a short delay ensure auth links are set
    setTimeout(()=> {
      ensureAuthLinks();
    }, 600);
  } catch (e) {
    console.warn('Iframe embed failed, will attempt blob fallback', e);
  }

  // Fallback: fetch as blob and show with <object> if iframe is blocked or stream not available.
  (async function fetchBlobFallback() {
    try {
      // If iframe exists, assume it works; otherwise try fallback
      const ifr = viewerWrapper && viewerWrapper.querySelector && viewerWrapper.querySelector('iframe');
      if (ifr) {
        // don't fetch blob immediately to avoid double download
        return;
      }
    } catch(e){}

    if (viewerWrapper) viewerWrapper.innerHTML = '<div style="padding:18px;color:var(--muted)">Đang tải tài liệu...</div>';
    try {
      const resp = await apiFetch(fileUrl, { method: 'GET' });
      if (!resp.ok) {
        const txt = await resp.text().catch(()=>null);
        throw new Error(`HTTP ${resp.status} ${resp.statusText}${txt?': '+txt.slice(0,200):''}`);
      }
      const contentType = resp.headers.get('content-type') || 'application/octet-stream';
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);

      const objectEl = document.createElement('object');
      objectEl.data = blobUrl;
      objectEl.type = contentType;
      objectEl.style.width = '100%';
      objectEl.style.height = '100%';
      objectEl.style.border = '0';

      if (viewerWrapper) {
        viewerWrapper.innerHTML = '';
        viewerWrapper.appendChild(objectEl);
      }

      // update download/raw links to blob URL for convenience
      if (downloadLink) downloadLink.href = blobUrl;
      if (rawLink) rawLink.href = blobUrl;

      window.addEventListener('beforeunload', () => { try{ URL.revokeObjectURL(blobUrl); } catch(e){} });

      ensureAuthLinks();
    } catch (err) {
      console.error('Lỗi tải tài liệu:', err);
      const safe = safeText(err.message || String(err));
      if (viewerWrapper) viewerWrapper.innerHTML = `<div style="padding:18px;color:#900;">Không thể tải tài liệu: ${safe}</div>
        <div style="padding:8px;"><a href="${fileUrl}" target="_blank" rel="noopener">Mở tài liệu ở tab mới</a></div>`;
      ensureAuthLinks();
    }
  })();

  /* ----------------- COMMENTS ----------------- */
  // Render comment list
  async function loadComments() {
    const fileId = qs('id');
    const list = document.getElementById('comments-list');
    if (!list) return;
    list.innerHTML = 'Đang tải bình luận...';
    try {
      const url = fileId ? '/api/comments?fileId=' + encodeURIComponent(fileId) : '/api/comments';
      const res = await apiFetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
      const j = await res.json().catch(()=>null);
      if (!res.ok || !j || !j.ok) {
        list.innerHTML = '<div class="muted">Không thể tải bình luận.</div>';
        console.warn('loadComments unexpected response', res.status, j);
        return;
      }
      const comments = j.comments || [];
      if (!comments.length) {
        list.innerHTML = '<div class="muted">Chưa có bình luận nào.</div>';
        return;
      }
      const frag = document.createDocumentFragment();
      comments.forEach(c => {
        const div = document.createElement('div');
        div.style.padding = '8px';
        div.style.borderBottom = '1px solid #eee';
        const who = document.createElement('div');
        who.style.fontWeight = '600';
        who.style.marginBottom = '4px';
        who.textContent = c.author || c.username || ('User #' + (c.user_id || ''));
        const when = document.createElement('div');
        when.className = 'muted';
        when.style.fontSize = '12px';
        when.textContent = c.created_at ? (new Date(c.created_at)).toLocaleString() : '';
        const cont = document.createElement('div');
        cont.textContent = c.content || '';
        div.appendChild(who);
        div.appendChild(when);
        div.appendChild(cont);
        frag.appendChild(div);
      });
      list.innerHTML = '';
      list.appendChild(frag);
    } catch (err) {
      console.error('loadComments error', err);
      const listEl = document.getElementById('comments-list');
      if (listEl) listEl.innerHTML = '<div class="muted">Lỗi khi tải bình luận.</div>';
    }
  }

  // Post a new comment (improved UX)
  async function postComment() {
    const fileId = qs('id');
    const textEl = document.getElementById('comment-text');
    const authorEl = document.getElementById('comment-author');
    const postBtn = document.getElementById('comment-post');

    if (!textEl) return;
    const content = textEl.value && textEl.value.trim();
    if (!content) { alert('Viết nội dung bình luận'); textEl.focus(); return; }

    const payload = { content };
    if (fileId) payload.fileId = fileId;
    const author = authorEl && authorEl.value && authorEl.value.trim();
    if (author) payload.author = author;

    // Disable UI while sending
    if (postBtn) { postBtn.disabled = true; postBtn.textContent = 'Đang gửi...'; }

    try {
      const res = await apiFetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });

      const j = await res.json().catch(()=>null);

      if (res.ok && j && j.ok) {
        // success
        textEl.value = '';
        await loadComments();
        // if user posted anonymously and provided an author, keep it
        if (authorEl && (!authorEl.disabled)) {
          authorEl.value = payload.author || '';
        }
      } else {
        // handle known server errors
        const errCode = j && j.error ? j.error : null;
        const errMsg = j && (j.message || j.error) ? (j.message || j.error) : ('HTTP ' + res.status);
        // Authentication required?
        if (res.status === 401 || errCode === 'login_required' || errMsg.toLowerCase().includes('login')) {
          alert('Bạn cần đăng nhập để gửi bình luận. Vui lòng đăng nhập rồi thử lại.');
          // open login page with ?next back to this page
          const login = document.getElementById('link-login');
          if (login) window.location.href = login.href;
        } else if (errCode === 'content_required') {
          alert('Nội dung bình luận bị trống.');
        } else {
          alert('Gửi bình luận thất bại: ' + safeText(String(errMsg)));
        }
      }
    } catch (err) {
      console.error('postComment error', err);
      alert('Lỗi mạng khi gửi bình luận. Thử lại.');
    } finally {
      if (postBtn) { postBtn.disabled = false; postBtn.textContent = 'Gửi bình luận'; }
    }
  }

  // Prepare comment form: load current user to disable author input if logged in
  async function prepareCommentForm() {
    const authorEl = document.getElementById('comment-author');
    const postBtn = document.getElementById('comment-post');
    const clearBtn = document.getElementById('comment-clear');

    if (postBtn) postBtn.addEventListener('click', (e) => { e.preventDefault(); postComment(); });
    if (clearBtn) clearBtn.addEventListener('click', (e)=>{ e.preventDefault(); const t = document.getElementById('comment-text'); if (t) t.value=''; });

    try {
      const res = await apiFetch('/api/me', { method: 'GET', headers: { 'Accept': 'application/json' } });
      const j = await res.json().catch(()=>null);
      if (res.ok && j && j.ok && j.user) {
        if (authorEl) {
          authorEl.value = j.user.displayName || j.user.username || '';
          authorEl.disabled = true;
          authorEl.placeholder = 'Bạn đang đăng nhập';
        }
      } else {
        if (authorEl) { authorEl.disabled = false; authorEl.placeholder = 'Tên (tuỳ chọn)'; }
      }
    } catch (err) {
      console.warn('prepareCommentForm check user failed', err);
      if (authorEl) { authorEl.disabled = false; authorEl.placeholder = 'Tên (tuỳ chọn)'; }
    }
  }

  // Init
  (function init(){
    ensureAuthLinks();
    prepareCommentForm();
    loadComments();
  })();

})();
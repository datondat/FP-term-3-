// public/file-viewer.js
// Simple viewer page script: builds "Mở tài liệu" (open in new tab) and "Tải về" links to /api/drive/file/:id
// Comments stored in localStorage keyed by comments:<fileId>

(function () {
  function qs(name) {
    const params = new URLSearchParams(location.search);
    return params.get(name);
  }

  function commentsKey(fileId){ return `comments:${fileId}`; }

  function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, m=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  function loadComments(fileId) {
    const list = document.getElementById('comments-list');
    if (!list) return;
    list.innerHTML = '';
    try {
      const raw = localStorage.getItem(commentsKey(fileId));
      const arr = raw ? JSON.parse(raw) : [];
      if (!arr.length) { list.innerHTML = '<div class="muted">Chưa có bình luận.</div>'; return; }
      arr.sort((a,b)=>b.ts-a.ts);
      arr.forEach(c=>{
        const el = document.createElement('div');
        el.style.borderTop = '1px solid rgba(0,0,0,0.04)';
        el.style.padding = '8px 0';
        el.innerHTML = `<div style="font-weight:700">${escapeHtml(c.author||'Ẩn danh')} <span class="muted" style="font-weight:400;font-size:12px"> • ${new Date(c.ts).toLocaleString()}</span></div>
                        <div style="margin-top:6px">${escapeHtml(c.text)}</div>`;
        list.appendChild(el);
      });
    } catch (e) {
      console.error(e);
      list.innerHTML = '<div class="muted">Lỗi khi tải bình luận.</div>';
    }
  }

  function postComment(fileId) {
    const author = document.getElementById('comment-author').value || 'Ẩn danh';
    const text = document.getElementById('comment-text').value || '';
    if (!text.trim()) return alert('Nhập nội dung bình luận.');
    const now = Date.now();
    const c = { id: now + '-' + Math.floor(Math.random()*1000), ts: now, author, text };
    try {
      const raw = localStorage.getItem(commentsKey(fileId));
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(c);
      localStorage.setItem(commentsKey(fileId), JSON.stringify(arr));
      document.getElementById('comment-text').value = '';
      loadComments(fileId);
    } catch (e) {
      console.error(e);
      alert('Không lưu được bình luận.');
    }
  }

  function clearForm() {
    document.getElementById('comment-author').value = '';
    document.getElementById('comment-text').value = '';
  }

  // init
  document.addEventListener('DOMContentLoaded', function () {
    const fileId = qs('id');
    const fileName = qs('name') ? decodeURIComponent(qs('name')) : '';
    if (!fileId) {
      document.getElementById('file-title').textContent = 'Không có file được chỉ định';
      return;
    }

    document.getElementById('file-title').textContent = fileName || 'Tài liệu';
    document.getElementById('file-meta').textContent = `ID: ${fileId}`;

    const rawLink = document.getElementById('raw-link');
    const downloadLink = document.getElementById('download-link');

    rawLink.href = `/api/drive/file/${encodeURIComponent(fileId)}`;
    downloadLink.href = `/api/drive/file/${encodeURIComponent(fileId)}`;
    downloadLink.setAttribute('download', fileName || '');

    loadComments(fileId);

    const postBtn = document.getElementById('comment-post');
    if (postBtn) postBtn.addEventListener('click', function(){ postComment(fileId); });

    const clearBtn = document.getElementById('comment-clear');
    if (clearBtn) clearBtn.addEventListener('click', clearForm);
  });
})();
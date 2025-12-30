// public/file-viewer.js
// Logic để nhúng/hiển thị tài liệu trên trang file.html?id=...&name=...
// - Recommended: server có route GET /api/drive/file/:id streaming file với Content-Type (PDF/...)
// - If backend runs on different origin, set window.API_BASE = 'http://localhost:5001' BEFORE loading this script.

(function () {
  function qs(name) {
    try { return (new URL(window.location.href)).searchParams.get(name); } catch (e) { return null; }
  }
  function safeText(s){ return String(s || '').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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
    viewerWrapper.innerHTML = '<div style="padding:18px;color:#900;">Thiếu tham số id. Ví dụ: /file.html?id=FILE_ID</div>';
    rawLink.style.display = 'none';
    downloadLink.style.display = 'none';
    return;
  }

  const API_BASE = (window.API_BASE === undefined) ? '' : (window.API_BASE || '');
  function apiPath(p){
    if (!p.startsWith('/')) p = '/' + p;
    return API_BASE ? API_BASE.replace(/\/$/, '') + p : p;
  }

  const fileUrl = apiPath(`/api/drive/file/${encodeURIComponent(id)}`);

  // Set controls
  rawLink.href = fileUrl;
  downloadLink.href = fileUrl;
  downloadLink.setAttribute('download', fileName || '');

  // Try embed via iframe first (streams, minimal memory)
  function createIframe(url) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.loading = 'eager';
    return iframe;
  }

  // Insert iframe and verify quickly (if browser blocks by X-Frame-Options, iframe may show blank or browser console will hint)
  try {
    viewerWrapper.innerHTML = '';
    const iframe = createIframe(fileUrl);
    viewerWrapper.appendChild(iframe);

    // set a short timeout to check if content likely blocked (heuristic)
    setTimeout(()=> {
      // If iframe contentWindow is accessible and location is about:blank or similar, we can't reliably detect block cross-origin.
      // We keep iframe; if blocked, user can use "Mở tài liệu" button which opens server stream in new tab.
    }, 800);
    // Done (recommended path)
    return;
  } catch (e) {
    console.warn('Iframe embed failed, falling back to fetch->blob', e);
  }

  // Fallback: fetch as blob then display via object (works when you need to add Authorization header)
  (async function fetchBlobFallback() {
    viewerWrapper.innerHTML = '<div style="padding:18px;color:var(--muted)">Đang tải tài liệu...</div>';
    try {
      // If you need auth header (JWT), add here. Example:
      // const token = localStorage.getItem('token');
      // const resp = await fetch(fileUrl, { headers: { Authorization: 'Bearer ' + token } });
      const resp = await fetch(fileUrl, {
        method: 'GET',
        // credentials: 'include' // enable if you need cookies/session
      });
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

      viewerWrapper.innerHTML = '';
      viewerWrapper.appendChild(objectEl);

      // update download link to blob URL
      downloadLink.href = blobUrl;
      rawLink.href = blobUrl;

      // revoke on unload
      window.addEventListener('beforeunload', () => { try{ URL.revokeObjectURL(blobUrl); } catch(e){} });
    } catch (err) {
      console.error('Lỗi tải tài liệu:', err);
      const safe = safeText(err.message || String(err));
      viewerWrapper.innerHTML = `<div style="padding:18px;color:#900;">Không thể tải tài liệu: ${safe}</div>
        <div style="padding:8px;"><a href="${fileUrl}" target="_blank" rel="noopener">Mở tài liệu ở tab mới</a></div>`;
    }
  })();

})();
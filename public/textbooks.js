// public/textbooks.js
// Client-side textbooks helper - exposes:
// - loadData() -> returns textbooks JSON
// - renderBooksListHTML(className, subjectName, books) -> HTML string used in resources area
// - showFor(...) (keeps modal functionality if needed)
//
// Place this file in public/ alongside main.js

(function () {
  const DATA_URL = '/data/textbooks.json';
  let textbooksData = null;

  async function loadData() {
    if (textbooksData) return textbooksData;
    try {
      const r = await fetch(DATA_URL);
      textbooksData = await r.json();
      return textbooksData;
    } catch (err) {
      console.error('Không thể load textbooks.json', err);
      textbooksData = {};
      return textbooksData;
    }
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
    });
  }

  function renderBooksListHTML(className, subjectName, books) {
    if (!books || books.length === 0) {
      return `<div class="muted">Chưa có sách cho ${escapeHtml(subjectName)} của ${escapeHtml(className)}.</div>`;
    }
    return `
      <div class="tb-list">
        ${books.map(b => `
          <article class="tb-item">
            <h4 class="tb-title">${escapeHtml(b.title)}</h4>
            <div class="tb-meta">${escapeHtml(b.publisher || '')} ${b.year ? '• ' + escapeHtml(b.year) : ''} ${b.format ? '• ' + escapeHtml(b.format) : ''}</div>
            <div class="tb-actions">
              <a class="btn btn-small" href="${escapeHtml(b.link)}" target="_blank" rel="noopener">Xem trên hoc10.vn</a>
              ${b.cover ? `<img src="${escapeHtml(b.cover)}" alt="${escapeHtml(b.title)}" style="height:60px;margin-left:8px;border-radius:6px" />` : ''}
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  // (Optional) modal quick-view: left intact but not used by new inline flow
  function createModal() {
    let modal = document.getElementById('textbooksModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'textbooksModal';
    modal.className = 'textbooks-modal';
    modal.innerHTML = `
      <div class="textbooks-modal-backdrop" data-close="1"></div>
      <div class="textbooks-modal-panel" role="dialog" aria-modal="true" aria-label="Danh sách sách giáo khoa">
        <header class="textbooks-modal-header">
          <h3 id="textbooksModalTitle">Sách giáo khoa</h3>
          <button class="textbooks-close" aria-label="Đóng">&times;</button>
        </header>
        <div class="textbooks-modal-body" id="textbooksModalBody"></div>
        <footer class="textbooks-modal-footer">
          <button class="btn btn-ghost" id="textbooksModalCloseBtn">Đóng</button>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', hideModal));
    modal.querySelector('.textbooks-close').addEventListener('click', hideModal);
    modal.querySelector('#textbooksModalCloseBtn').addEventListener('click', hideModal);
    return modal;
  }

  function showModal(title, htmlContent) {
    const modal = createModal();
    modal.querySelector('#textbooksModalTitle').textContent = title;
    modal.querySelector('#textbooksModalBody').innerHTML = htmlContent || '<div class="muted">Không có sách.</div>';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function hideModal() {
    const modal = document.getElementById('textbooksModal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // delegated click (if old modal "show-material" buttons used)
  document.addEventListener('click', async function (e) {
    const btn = e.target.closest && e.target.closest('.show-material');
    if (!btn) return;
    e.preventDefault();
    const subject = btn.dataset.sub;
    const className = btn.dataset.class ||
      (document.getElementById('subjectsTitle') && (document.getElementById('subjectsTitle').textContent.match(/Các môn của\s*(.+)/) || [null,null])[1])
      || 'Unknown';
    const data = await loadData();
    const classObj = data[className] || {};
    const books = classObj[subject] || [];
    const title = `Sách giáo khoa: ${subject} — ${className}`;
    const html = renderBooksListHTML(className, subject, books);
    showModal(title, html);
  });

  // page rendering for textbooks.html - uses same renderer
  async function renderOnTextbooksPage() {
    const container = document.getElementById('textbooksPageBody');
    const titleEl = document.getElementById('textbooksPageTitle');
    if (!container) return;
    const params = (new URLSearchParams(location.search));
    const className = params.get('class') || params.get('lop') || '';
    const subject = params.get('subject') || params.get('mon') || '';
    const data = await loadData();
    const books = (data[className] || {})[subject] || [];
    if (titleEl) titleEl.textContent = `Sách giáo khoa: ${subject || ''} ${className ? '— ' + className : ''}`;
    container.innerHTML = renderBooksListHTML(className || 'Chưa chọn lớp', subject || 'Chưa chọn môn', books);
  }

  // expose API
  window.Textbooks = {
    loadData,
    renderBooksListHTML,
    showFor(className, subjectName) {
      loadData().then((data) => {
        const books = (data[className] || {})[subjectName] || [];
        const title = `Sách giáo khoa: ${subjectName} — ${className}`;
        const html = renderBooksListHTML(className, subjectName, books);
        showModal(title, html);
      });
    },
    renderOnTextbooksPage
  };

  // auto-render if textbooks.html loaded
  document.addEventListener('DOMContentLoaded', function () {
    renderOnTextbooksPage();
  });
})();
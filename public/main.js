/* public/main.js
   Thay thế hoàn chỉnh: thêm autocomplete dropdown + xử lý lỗi tốt hơn.
   Sửa: đảm bảo gửi credentials khi cần và redirect admin khi login (sang admin.html).
*/
document.addEventListener('DOMContentLoaded', () => {
  // mapping lớp -> môn
  const classSubjects = {
    "Lớp 6": ["Toán","Ngữ văn","Tiếng Anh","Khoa học tự nhiên","Lịch sử","Địa lý"],
    "Lớp 7": ["Toán","Ngữ văn","Tiếng Anh","Vật lý cơ bản","Sinh học","Công nghệ"],
    "Lớp 8": ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Lịch sử"],
    "Lớp 9": ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học"],
    "Lớp 10": ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học"],
    "Lớp 11": ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học"],
    "Lớp 12": ["Toán","Ngữ văn","Tiếng Anh","Vật lý","Hóa học","Sinh học"],
    "Giáo án - Đề thi": ["Đề thi THCS","Đề thi THPT","Giáo án mẫu"]
  };

  // Elements
  const subjectsGrid = document.getElementById('subjectsGrid');
  const subjectsTitle = document.getElementById('subjectsTitle');
  const categoryArea = document.getElementById('categoryArea');
  const subjectsView = document.getElementById('subjectsView');
  const backBtn = document.getElementById('backToClasses');
  const menuLinks = document.querySelectorAll('.menu-class a[data-class]');
  const accordionBtns = document.querySelectorAll('.accordion-button');
  const searchForm = document.getElementById('searchForm');
  const openLogin = document.getElementById('openLogin');
  const inlineLogin = document.getElementById('inlineLogin');
  const inlineLoginForm = document.getElementById('inlineLoginForm');
  const inlineCancel = document.getElementById('inlineCancel');
  const userDropdown = document.getElementById('userDropdown');
  const avatarBtn = document.getElementById('avatarBtn');

  // --- Helper utils ---
  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }
  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // --- Result container (full results) ---
  const resultsContainerId = 'searchResultsContainer';
  let resultsContainer = document.getElementById(resultsContainerId);
  if (!resultsContainer) {
    resultsContainer = document.createElement('section');
    resultsContainer.id = resultsContainerId;
    resultsContainer.className = 'search-results';
    const mainNode = document.querySelector('main') || null;
    document.body.insertBefore(resultsContainer, mainNode);
  }

  function renderResults(data) {
    resultsContainer.innerHTML = '';
    if (!data || !data.results || data.results.length === 0) {
      resultsContainer.innerHTML = '<p class="no-results">Không tìm thấy kết quả.</p>';
      return;
    }

    const info = document.createElement('div');
    info.className = 'results-info';
    info.textContent = `Tìm thấy ${data.total} kết quả — Trang ${data.page}`;
    resultsContainer.appendChild(info);

    const list = document.createElement('div');
    list.className = 'results-list';
    data.results.forEach(r => {
      const it = r.item;
      const card = document.createElement('article');
      card.className = 'result-card';
      card.innerHTML = `
        <h3 class="result-title"><a href="${escapeHtml(it.url || '#')}">${escapeHtml(it.title || '(Không có tiêu đề)')}</a></h3>
        <div class="result-meta">${escapeHtml(it.subject || '')} ${it.tags ? ' · ' + escapeHtml((it.tags || []).join(', ')) : ''}</div>
        <p class="result-snippet">${escapeHtml((it.content || '').slice(0, 250))}...</p>
      `;
      list.appendChild(card);
    });
    resultsContainer.appendChild(list);

    // Pagination controls if needed
    const totalPages = Math.ceil((data.total || 0) / (data.perPage || 10));
    if (totalPages > 1) {
      const pager = document.createElement('div');
      pager.className = 'results-pager';
      const cur = data.page || 1;
      if (cur > 1) {
        const prev = document.createElement('button');
        prev.className = 'btn pager-btn';
        prev.textContent = '‹ Trước';
        prev.addEventListener('click', () => doSearch(currentQuery, cur - 1));
        pager.appendChild(prev);
      }
      const pageInfo = document.createElement('span');
      pageInfo.textContent = `Trang ${cur} / ${totalPages}`;
      pager.appendChild(pageInfo);
      if (cur < totalPages) {
        const next = document.createElement('button');
        next.className = 'btn pager-btn';
        next.textContent = 'Tiếp ›';
        next.addEventListener('click', () => doSearch(currentQuery, cur + 1));
        pager.appendChild(next);
      }
      resultsContainer.appendChild(pager);
    }
  }

  let currentQuery = '';

  async function doSearch(q, page = 1) {
    currentQuery = q;
    if (!q) {
      renderResults({ total: 0, page: 1, perPage: 10, results: [] });
      return;
    }
    resultsContainer.innerHTML = '<p class="loading">Đang tìm kiếm…</p>';
    try {
      const res = await fetch('/api/search?q=' + encodeURIComponent(q) + '&page=' + page + '&limit=10', {
        credentials: 'same-origin'
      });
      if (!res.ok) {
        // show friendly message in results area
        const text = await safeText(res);
        resultsContainer.innerHTML = `<p class="error">Lỗi khi tìm kiếm: ${escapeHtml(res.status + ' ' + res.statusText)} ${escapeHtml(text)}</p>`;
        return;
      }
      const data = await res.json();
      renderResults(data);
    } catch (err) {
      resultsContainer.innerHTML = `<p class="error">Lỗi khi tìm kiếm: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function safeText(res) {
    try {
      return await res.text();
    } catch (e) {
      return '';
    }
  }

  // --- Autocomplete dropdown ---
  // Create dropdown element
  const dropdownId = 'searchAutocomplete';
  let dropdown = document.getElementById(dropdownId);
  const inputEl = searchForm ? searchForm.querySelector('.search-input') : null;
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = dropdownId;
    dropdown.className = 'search-autocomplete hidden';
    document.body.appendChild(dropdown);
  }

  let activeIndex = -1;
  let suggestions = [];
  function positionDropdown() {
    if (!inputEl || !dropdown) return;
    const rect = inputEl.getBoundingClientRect();
    dropdown.style.width = Math.max(240, rect.width) + 'px';
    // place dropdown aligned to input (fixed positioning to not be cut off)
    dropdown.style.left = (rect.left + window.scrollX) + 'px';
    dropdown.style.top = (rect.bottom + window.scrollY + 6) + 'px';
  }

  function showDropdown(items) {
    suggestions = items || [];
    activeIndex = -1;
    dropdown.innerHTML = '';
    if (!items || items.length === 0) {
      dropdown.classList.add('hidden');
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'autocomplete-list';
    items.forEach((it, i) => {
      const li = document.createElement('li');
      li.className = 'autocomplete-item';
      li.innerHTML = `
        <div class="title">${escapeHtml(it.title || it.name || '(Không tiêu đề)')}</div>
        <div class="meta">${escapeHtml(it.subject || '')}${it.tags ? ' · ' + escapeHtml((it.tags||[]).slice(0,3).join(', ')) : ''}</div>
      `;
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        selectSuggestion(i);
      });
      ul.appendChild(li);
    });
    dropdown.appendChild(ul);
    dropdown.classList.remove('hidden');
    positionDropdown();
  }

  function hideDropdown() {
    dropdown.classList.add('hidden');
    activeIndex = -1;
    suggestions = [];
  }

  function selectSuggestion(index) {
    if (!suggestions[index]) return;
    const it = suggestions[index];
    // If item has url, navigate; else set input value and run full search
    if (it.url) {
      window.location.href = it.url;
    } else {
      inputEl.value = it.title || it.name || '';
      hideDropdown();
      doSearch(inputEl.value, 1);
    }
  }

  function highlightActive() {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    items.forEach((el, i) => {
      if (i === activeIndex) el.classList.add('active');
      else el.classList.remove('active');
    });
  }

  // Try suggest endpoint first; fallback to search with small limit
  async function fetchSuggestions(q) {
    if (!q) return [];
    try {
      // Prefer /api/suggest
      let res = await fetch('/api/suggest?q=' + encodeURIComponent(q), { credentials: 'same-origin' });
      if (res.ok) {
        const d = await res.json();
        return d.suggestions || [];
      }
      // fallback: use /api/search with small limit
      res = await fetch('/api/search?q=' + encodeURIComponent(q) + '&limit=6', { credentials: 'same-origin' });
      if (!res.ok) return [];
      const sd = await res.json();
      return (sd.results || []).map(r => r.item || r);
    } catch (err) {
      // network error -> return empty suggestions
      return [];
    }
  }

  // keyboard navigation on input
  if (inputEl) {
    inputEl.addEventListener('input', debounce(async (e) => {
      const q = e.target.value || '';
      if (!q) {
        hideDropdown();
        return;
      }
      const items = await fetchSuggestions(q);
      showDropdown(items);
    }, 200));

    // reposition dropdown on resize/scroll
    window.addEventListener('resize', positionDropdown);
    window.addEventListener('scroll', positionDropdown);

    inputEl.addEventListener('keydown', (e) => {
      if (dropdown.classList.contains('hidden')) return;
      const len = suggestions.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % len;
        highlightActive();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + len) % len;
        highlightActive();
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) {
          e.preventDefault();
          selectSuggestion(activeIndex);
        } else {
          // submit search
          e.preventDefault();
          const q = inputEl.value || '';
          hideDropdown();
          doSearch(q, 1);
        }
      } else if (e.key === 'Escape') {
        hideDropdown();
      }
    });
  }

  // close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== inputEl) {
      hideDropdown();
    }
  });

  // Attach search handlers (replaces old alert-based handler)
  if (searchForm) {
    // submit handler
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = new FormData(searchForm).get('q') || '';
      hideDropdown();
      doSearch(q, 1);
    });
  }

  // --- Existing UI code for subjects, login, etc. (kept mostly unchanged) ---
  function renderSubjectsList(className) {
    const subjects = classSubjects[className] || [];
    subjectsGrid.innerHTML = '';
    subjectsTitle.textContent = `Các môn của ${className}`;

    if (!subjects.length) {
      subjectsGrid.innerHTML = '<p>Chưa có môn cho lớp này.</p>';
      return;
    }

    subjects.forEach(sub => {
      const card = document.createElement('div');
      card.className = 'subject-card';
      card.innerHTML = `
        <div class="subject-name">${sub}</div>
        <button class="btn show-material" data-sub="${sub}">Xem tài liệu</button>
      `;
      subjectsGrid.appendChild(card);
    });
  }
  function showSubjects(className) {
    renderSubjectsList(className);
    categoryArea.classList.add('hidden');
    document.querySelectorAll('.accordion-item').forEach(it => {
      it.classList.add('hidden-item');
      it.classList.remove('active');
    });
    subjectsView.classList.remove('hidden');
    subjectsView.setAttribute('aria-hidden', 'false');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function hideSubjects() {
    document.querySelectorAll('.accordion-item').forEach(it => {
      it.classList.remove('hidden-item');
    });
    subjectsView.classList.add('hidden');
    subjectsView.setAttribute('aria-hidden', 'true');
    categoryArea.classList.remove('hidden');
    categoryArea && categoryArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  menuLinks.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const cls = a.dataset.class;
      if (cls) showSubjects(cls);
    });
  });
  accordionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cls = btn.dataset.class;
      if (cls) showSubjects(cls);
    });
  });
  backBtn && backBtn.addEventListener('click', hideSubjects);
  document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('.show-material')) {
      const sub = e.target.dataset.sub;
      alert('Bạn chọn môn: ' + sub);
    }
  });

  // Inline login open
  if (openLogin) {
    openLogin.addEventListener('click', (e) => {
      e.preventDefault();
      inlineLogin.classList.remove('hidden');
      inlineLogin.setAttribute('aria-hidden', 'false');
      inlineLogin.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const first = inlineLogin.querySelector('input[name="username"]');
      first && first.focus();
      userDropdown && userDropdown.classList.remove('open');
    });
  }
  inlineCancel && inlineCancel.addEventListener('click', () => {
    inlineLogin.classList.add('hidden');
    inlineLogin.setAttribute('aria-hidden', 'true');
  });
  // Inline login: only bind AJAX if form does not opt-out
if (inlineLoginForm && !inlineLoginForm.dataset.noAjax) {
  inlineLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(inlineLoginForm);
    const payload = { username: fd.get('username'), password: fd.get('password') };
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(()=>null);
      if (res.ok && json && json.ok) {
        if (json.user && json.user.role === 'admin') {
          window.location.href = '/admin';
          return;
        }
        inlineLogin.classList.add('hidden');
        inlineLogin.setAttribute('aria-hidden', 'true');
        await loadUser();
      } else {
        alert('Lỗi đăng nhập: ' + (json && (json.error || json.message) || 'Thông tin không đúng'));
      }
    } catch (err) {
      alert('Lỗi mạng, thử lại');
    }
  });
}

  avatarBtn && avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown && userDropdown.classList.toggle('open');
    userDropdown && userDropdown.setAttribute('aria-hidden', !userDropdown.classList.contains('open'));
  });
  document.addEventListener('click', () => {
    if (userDropdown) {
      userDropdown.classList.remove('open');
      userDropdown.setAttribute('aria-hidden', 'true');
    }
  });
  userDropdown && userDropdown.addEventListener('click', (e) => e.stopPropagation());

  // Load current user state
  async function loadUser() {
    try {
      const r = await fetch('/api/me', { credentials: 'include' });
      const j = await r.json().catch(()=>null);
      const logged = j && j.user;
      const userNot = document.getElementById('userNotLogged');
      const userLogged = document.getElementById('userLogged');
      const userNameDisplay = document.getElementById('userNameDisplay');
      if (logged) {
        userNot && (userNot.style.display = 'none');
        userLogged && (userLogged.style.display = 'block');
        userNameDisplay && (userNameDisplay.textContent = logged.displayName || logged.username);
      } else {
        userNot && (userNot.style.display = 'block');
        userLogged && (userLogged.style.display = 'none');
      }
    } catch (err) {
      // ignore
    }
  }
  loadUser();
});
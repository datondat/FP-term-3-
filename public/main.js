// public/main.js
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

  // Render subjects grid
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

  // Show/hide subjects
  function showSubjects(className) {
    renderSubjectsList(className);

    // hide class list area (keep DOM)
    categoryArea.classList.add('hidden');

    // hide each accordion-item (so that when we come back we can restore)
    document.querySelectorAll('.accordion-item').forEach(it => {
      it.classList.add('hidden-item');
      it.classList.remove('active');
    });

    subjectsView.classList.remove('hidden');
    subjectsView.setAttribute('aria-hidden', 'false');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hideSubjects() {
    // unhide accordion items
    document.querySelectorAll('.accordion-item').forEach(it => {
      it.classList.remove('hidden-item');
    });

    subjectsView.classList.add('hidden');
    subjectsView.setAttribute('aria-hidden', 'true');
    categoryArea.classList.remove('hidden');

    // scroll to category area
    categoryArea && categoryArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Attach events: menu links
  menuLinks.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const cls = a.dataset.class;
      if (cls) showSubjects(cls);
    });
  });

  // Attach events: accordion buttons (so they also open subjects when clicked)
  accordionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cls = btn.dataset.class;
      if (cls) showSubjects(cls);
    });
  });

  // Back button
  backBtn && backBtn.addEventListener('click', hideSubjects);

  // Delegate click for "Xem tài liệu"
  document.addEventListener('click', (e) => {
    if (e.target && e.target.matches('.show-material')) {
      const sub = e.target.dataset.sub;
      // TODO: navigate to subject page or fetch materials
      alert('Bạn chọn môn: ' + sub);
    }
  });

  // Search form submit (calls /api/search)
  if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = new FormData(searchForm).get('q') || '';
      try {
        const res = await fetch('/api/search?q=' + encodeURIComponent(q));
        const data = await res.json();
        // Temporary: show results in a simple alert. Replace with in-page render if needed.
        alert('Kết quả: ' + (data.results && data.results.length ? data.results.map(r => r.title).join(', ') : 'Không có'));
      } catch (err) {
        alert('Lỗi tìm kiếm');
      }
    });
  }

  // Inline login open
  if (openLogin) {
    openLogin.addEventListener('click', (e) => {
      e.preventDefault();
      inlineLogin.classList.remove('hidden');
      inlineLogin.setAttribute('aria-hidden', 'false');
      inlineLogin.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const first = inlineLogin.querySelector('input[name="username"]');
      first && first.focus();
      // close dropdown
      userDropdown && userDropdown.classList.remove('open');
    });
  }

  // Inline login cancel
  inlineCancel && inlineCancel.addEventListener('click', () => {
    inlineLogin.classList.add('hidden');
    inlineLogin.setAttribute('aria-hidden', 'true');
  });

  // Inline login submit
  inlineLoginForm && inlineLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(inlineLoginForm);
    const payload = { username: fd.get('username'), password: fd.get('password') };
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.ok) {
        inlineLogin.classList.add('hidden');
        inlineLogin.setAttribute('aria-hidden', 'true');
        loadUser();
      } else {
        alert('Lỗi đăng nhập: ' + (json.message || 'Thông tin không đúng'));
      }
    } catch (err) {
      alert('Lỗi mạng, thử lại');
    }
  });

  // Avatar dropdown
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
      const r = await fetch('/api/me');
      const j = await r.json();
      const logged = j.user;
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

  // initial load
  loadUser();
});
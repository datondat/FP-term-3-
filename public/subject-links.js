// public/subject-links.js
// Fully integrated: static hoc10.vn mapping + Drive lookup.
// - Tries server-side convenience endpoint /api/drive/search?grade=...&subject=...
// - If search not available/fails, falls back to folderId flow:
//     /api/drive/folders (root) -> /api/drive/folders?parentId=... -> /api/drive/files?folderId=...
// - Configure API base (port/host) via window.API_BASE, e.g. window.API_BASE = 'http://localhost:5001'
// - Timeout: 12s
// - Fixed: added escapeHtml and normalizeName to avoid ReferenceError

(function () {
  // ----------------------------
  // API base helper
  // ----------------------------
  const API_BASE = (window.API_BASE === undefined) ? '' : (window.API_BASE || '');
  function apiUrl(path) {
    if (!path || path[0] !== '/') path = '/' + (path || '');
    if (!API_BASE) return path;
    return API_BASE.replace(/\/$/, '') + path;
  }

  // ----------------------------
  // Helpers (added escapeHtml + normalizeName)
  // ----------------------------
  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]);
    });
  }
  function normalizeName(s) {
    if (!s) return '';
    try {
      return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    } catch (e) {
      return String(s).toLowerCase().trim();
    }
  }

  // fetch with timeout helper
  async function fetchWithTimeout(url, opts = {}, timeout = 12000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, Object.assign({}, opts, { signal: controller.signal }));
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }
  async function apiGetJson(url) {
    const res = await fetchWithTimeout(url, {}, 12000);
    if (!res.ok) {
      const text = await res.text().catch(() => null);
      const err = new Error(`${res.status} ${res.statusText}${text ? ': ' + text : ''}`);
      err._status = res.status;
      err._body = text;
      throw err;
    }
    return res.json();
  }

  // ----------------------------
  // Static mapping (hoc10.vn)
  // ----------------------------
  const SUBJECT_LINKS = {
    6: {
      'Ngữ văn': [
        {label: 'Ngữ văn 6 - SGK Tập 1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-1/1/22/0/'},
        {label: 'Ngữ văn 6 - SGK Tập 2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-2/1/23/0/'},
        {label: 'SBT Ngữ Văn 6 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-1/5/50/0/'},
        {label: 'SBT Ngữ Văn 6 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-2/5/174/0/'}
      ],
      'Toán': [
        {label:'Toán 6 - SGK T1', url:'https://www.hoc10.vn/doc-sach/toan-6-1/1/24/0/'},
        {label:'Toán 6 - SGK T2', url:'https://www.hoc10.vn/doc-sach/toan-6-2/1/35/0/'},
        {label:'SBT Toán 6 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-toan-6-tap-1/5/52/0/'},
        {label:'SBT Toán 6 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-toan-6-tap-2/5/178/0/'}
      ],
      'Tiếng Anh': [
        {label:'Tiếng Anh 6 (SGK)', url:'https://www.hoc10.vn/doc-sach/tieng-anh-6/1/30/0/'},
        {label:'SBT Tiếng Anh 6', url:'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-6/5/82/0/'}
      ],
      'Tin học': [
        {label:'Tin học 6 (SGK)', url:'https://www.hoc10.vn/doc-sach/tin-hoc-6/1/28/0/'}
      ]
    },
    7: {
      'Ngữ văn': [
        {label:'Ngữ văn 7 - SGK T1', url:'https://www.hoc10.vn/doc-sach/ngu-van-7-tap-1/1/139/0/'},
        {label:'Ngữ văn 7 - SGK T2', url:'https://www.hoc10.vn/doc-sach/ngu-van-7-tap-2/1/140/0/'},
        {label:'SBT Ngữ Văn 7 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-7-tap-1/5/282/0/'},
        {label:'SBT Ngữ Văn 7 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-7-tap-2/5/283/0/'}
      ],
      'Toán': [
        {label:'Toán 7 - SGK T1', url:'https://www.hoc10.vn/doc-sach/toan-7-tap-1/1/141/0/'},
        {label:'Toán 7 - SGK T2', url:'https://www.hoc10.vn/doc-sach/toan-7-tap-2/1/142/0/'},
        {label:'SBT Toán 7 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-toan-7-tap-1/5/284/0/'},
        {label:'SBT Toán 7 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-toan-7-tap-2/5/285/0/'}
      ],
      'Tiếng Anh': [
        {label:'Tiếng Anh 7 (SGK)', url:'https://www.hoc10.vn/doc-sach/tieng-anh-7/1/152/0/'},
        {label:'SBT Tiếng Anh 7', url:'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-7/5/275/0/'}
      ],
      'Tin học': [
        {label:'Tin học 7 (SGK)', url:'https://www.hoc10.vn/doc-sach/tin-hoc-7/1/147/0/'}
      ]
    },
    8: {
      'Ngữ văn': [
        {label:'Ngữ văn 8 - SGK T1', url:'https://www.hoc10.vn/doc-sach/ngu-van-8-tap-1/1/412/0/'},
        {label:'Ngữ văn 8 - SGK T2', url:'https://www.hoc10.vn/doc-sach/ngu-van-8-tap-2/1/414/0/'},
        {label:'SBT Ngữ Văn 8 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-8-tap-1/5/422/0/'},
        {label:'SBT Ngữ Văn 8 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-8-tap-2/5/423/0/'}
      ],
      'Toán': [
        {label:'Toán 8 - SGK T1', url:'https://www.hoc10.vn/doc-sach/toan-8-tap-1/1/417/0/'},
        {label:'Toán 8 - SGK T2', url:'https://www.hoc10.vn/doc-sach/toan-8-tap-2/1/419/0/'},
        {label:'SBT Toán 8 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-toan-8-tap-1/5/425/0/'},
        {label:'SBT Toán 8 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-toan-8-tap-2/5/427/0/'}
      ],
      'Tiếng Anh': [
        {label:'Tiếng Anh 8 (SGK)', url:'https://www.hoc10.vn/doc-sach/tieng-anh-8/1/589/0/'},
        {label:'SBT Tiếng Anh 8', url:'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-8/5/588/0/'}
      ],
      'Tin học': [
        {label:'Tin học 8 (SGK)', url:'https://www.hoc10.vn/doc-sach/tin-hoc-8/1/421/0/'}
      ]
    },
    9: {
      'Ngữ văn': [
        {label:'Ngữ văn 9 - SGK T1', url:'https://www.hoc10.vn/doc-sach/ngu-van-9-tap-1/1/697/0/'},
        {label:'Ngữ văn 9 - SGK T2', url:'https://www.hoc10.vn/doc-sach/ngu-van-9-tap-2/1/698/0/'},
        {label:'SBT Ngữ Văn 9 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-9-tap-1/5/713/0/'},
        {label:'SBT Ngữ Văn 9 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-9-tap-2/5/714/0/'}
      ],
      'Toán': [
        {label:'Toán 9 - SGK T1', url:'https://www.hoc10.vn/doc-sach/toan-9-tap-1/1/699/0/'},
        {label:'Toán 9 - SGK T2', url:'https://www.hoc10.vn/doc-sach/toan-9-tap-2/1/700/0/'},
        {label:'SBT Toán 9 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-toan-9-tap-1/5/715/0/'},
        {label:'SBT Toán 9 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-toan-9-tap-2/5/716/0/'}
      ],
      'Tiếng Anh': [
        {label:'Tiếng Anh 9 (SGK)', url:'https://www.hoc10.vn/doc-sach/tieng-anh-9/1/800/0/'},
        {label:'SBT Tiếng Anh 9', url:'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-9/5/803/0/'}
      ],
      'Tin học': [
        {label:'Tin học 9 (SGK)', url:'https://www.hoc10.vn/doc-sach/tin-hoc-9/1/701/0/'}
      ]
    },
    10: {
      'Ngữ văn': [
        {label:'Ngữ văn 10 - SGK T1', url:'https://www.hoc10.vn/doc-sach/ngu-van-10-tap-1/1/153/0/'},
        {label:'Ngữ văn 10 - SGK T2', url:'https://www.hoc10.vn/doc-sach/ngu-van-10-tap-2/1/154/0/'},
        {label:'Chuyên đề NGV 10', url:'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-ngu-van-10/1/199/0/'},
        {label:'SBT Ngữ Văn 10 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-10-tap-1/5/288/0/'},
        {label:'SBT Ngữ Văn 10 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-10-tap-2/5/289/0/'}
      ],
      'Toán': [
        {label:'Toán 10 - T1', url:'https://www.hoc10.vn/doc-sach/toan-10-tap-1/1/155/0/'},
        {label:'Toán 10 - T2', url:'https://www.hoc10.vn/doc-sach/toan-10-tap-2/1/156/0/'},
        {label:'Chuyên đề Toán 10', url:'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-toan-10/1/200/0/'},
        {label:'SBT Toán 10 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-toan-10-tap-1/5/286/0/'},
        {label:'SBT Toán 10 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-toan-10-tap-2/5/287/0/'}
      ],
      'Tiếng Anh': [
        {label:'Tiếng Anh 10 (SGK)', url:'https://www.hoc10.vn/doc-sach/tieng-anh-10/1/173/0/'},
        {label:'SBT Tiếng Anh 10', url:'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-10/5/212/0/'}
      ],
      'Tin học': [
        {label:'Tin học 10 (SGK - Ứng dụng)', url:'https://www.hoc10.vn/doc-sach/tin-hoc-10/1/164/0/'},
        {label:'Chuyên đề Tin học 10 (ứng dụng)', url:'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-tin-hoc-10-(tin-hoc-ung-dung)/1/205/0/'},
        {label:'Chuyên đề Tin học 10 (khoa học máy tính)', url:'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-tin-hoc-10-(khoa-hoc-may-tinh)/1/206/0/'}
      ]
    },
    11: {
      'Ngữ văn': [
        {label:'Ngữ văn 11 - T1', url:'https://www.hoc10.vn/doc-sach/ngu-van-11-tap-1/1/444/0/'},
        {label:'Ngữ văn 11 - T2', url:'https://www.hoc10.vn/doc-sach/ngu-van-11-tap-2/1/445/0/'},
        {label:'Chuyên đề NGV 11', url:'https://www.hoc10.vn/doc-sach/cd-ngu-van-11/1/395/0/'},
        {label:'SBT Ngữ Văn 11 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-11-tap-1/5/430/0/'},
        {label:'SBT Ngữ Văn 11 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-11-tap-2/5/432/0/'}
      ],
      'Toán': [
        {label:'Toán 11 - T1', url:'https://www.hoc10.vn/doc-sach/toan-11-tap-1/1/446/0/'},
        {label:'Toán 11 - T2', url:'https://www.hoc10.vn/doc-sach/toan-11-tap-2/1/447/0/'},
        {label:'Chuyên đề Toán 11', url:'https://www.hoc10.vn/doc-sach/cd-toan-11/1/396/0/'},
        {label:'SBT Toán 11 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-toan-11-tap-1/5/433/0/'},
        {label:'SBT Toán 11 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-toan-11-tap-2/5/435/0/'}
      ],
      'Tiếng Anh': [
        {label:'Tiếng Anh 11 (SGK)', url:'https://www.hoc10.vn/doc-sach/tieng-anh-11/1/592/0/'},
        {label:'SBT Tiếng Anh 11', url:'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-11/5/591/0/'}
      ],
      'Tin học': [
        {label:'Tin học 11 - Khoa học máy tính', url:'https://www.hoc10.vn/doc-sach/tin-hoc-11-khoa-hoc-may-tinh/1/387/0/'},
        {label:'Tin học 11 - Ứng dụng', url:'https://www.hoc10.vn/doc-sach/tin-hoc-11-tin-hoc-ung-dung/1/386/0/'},
        {label:'Chuyên đề Tin học 11 (khoa học máy tính)', url:'https://www.hoc10.vn/doc-sach/cd-tin-hoc-11-khoa-hoc-may-tinh/1/410/0/'},
        {label:'Chuyên đề Tin học 11 (ứng dụng)', url:'https://www.hoc10.vn/doc-sach/cd-tin-hoc-11-tin-hoc-ung-dung/1/408/0/'}
      ]
    },
    12: {
      'Ngữ văn': [
        {label:'Ngữ văn 12 - T1', url:'https://www.hoc10.vn/doc-sach/ngu-van-12-tap-1/1/719/0/'},
        {label:'Ngữ văn 12 - T2', url:'https://www.hoc10.vn/doc-sach/ngu-van-12-tap-2/1/720/0/'},
        {label:'Chuyên đề NGV 12', url:'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-ngu-van-12/1/740/0/'},
        {label:'SBT Ngữ Văn 12 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-12-tap-1/5/752/0/'},
        {label:'SBT Ngữ Văn 12 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-ngu-van-12-tap-2/5/753/0/'}
      ],
      'Toán': [
        {label:'Toán 12 - T1', url:'https://www.hoc10.vn/doc-sach/toan-12-tap-1/1/721/0/'},
        {label:'Toán 12 - T2', url:'https://www.hoc10.vn/doc-sach/toan-12-tap-2/1/722/0/'},
        {label:'Chuyên đề Toán 12', url:'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-toan-12/1/741/0/'},
        {label:'SBT Toán 12 - T1', url:'https://www.hoc10.vn/doc-sach/sbt-toan-12-tap-1/5/754/0/'},
        {label:'SBT Toán 12 - T2', url:'https://www.hoc10.vn/doc-sach/sbt-toan-12-tap-2/5/755/0/'}
      ],
      'Tiếng Anh': [
        {label:'Tiếng Anh 12 (SGK)', url:'https://www.hoc10.vn/doc-sach/tieng-anh-12/1/801/0/'},
        {label:'SBT Tiếng Anh 12', url:'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-12/5/804/0/'}
      ],
      'Tin học': [
        {label:'Tin học 12 - Ứng dụng', url:'https://www.hoc10.vn/doc-sach/tin-hoc-12-tin-hoc-ung-dung/1/737/0/'},
        {label:'Tin học 12 - Khoa học máy tính', url:'https://www.hoc10.vn/doc-sach/tin-hoc-12-khoa-hoc-may-tinh/1/738/0/'},
        {label:'Chuyên đề Tin học 12 (ứng dụng)', url:'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-tin-hoc-12-tin-hoc-ung-dung/1/749/0/'},
        {label:'Chuyên đề Tin học 12 (khoa-hoc-may-tinh)', url:'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-tin-hoc-12-khoa-hoc-may-tinh/1/750/0/'}
      ]
    }
  };

  // ----------------------------
  // Drive folder helpers (fallback flow)
  // ----------------------------
  const DRIVE_CACHE = { rootFolders: null, subfoldersByParent: new Map() };
  function clearDriveCache(){ DRIVE_CACHE.rootFolders = null; DRIVE_CACHE.subfoldersByParent.clear(); }

  async function resolveGradeFolderIdViaFolders(grade) {
    if (!DRIVE_CACHE.rootFolders) {
      const resp = await apiGetJson(apiUrl('/api/drive/folders'));
      DRIVE_CACHE.rootFolders = resp.folders || [];
    }
    const folders = DRIVE_CACHE.rootFolders;
    const candidates = [`lớp ${grade}`, `lop ${grade}`, `lớp${grade}`, `lop${grade}`, `${grade}`].map(normalizeName);
    for (const f of folders) if (candidates.includes(normalizeName(f.name))) return f.id;
    for (const f of folders) {
      const n = normalizeName(f.name);
      if (candidates.some(c => n.includes(c) || c.includes(n))) return f.id;
    }
    return null;
  }

  async function listSubfolders(parentId) {
    if (DRIVE_CACHE.subfoldersByParent.has(parentId)) return DRIVE_CACHE.subfoldersByParent.get(parentId);
    const resp = await apiGetJson(apiUrl('/api/drive/folders?parentId=' + encodeURIComponent(parentId)));
    const arr = resp.folders || [];
    DRIVE_CACHE.subfoldersByParent.set(parentId, arr);
    return arr;
  }

  async function resolveSubjectFolderUnderGradeViaFolders(gradeFolderId, subjectName) {
    const subs = await listSubfolders(gradeFolderId);
    const target = normalizeName(subjectName);
    let found = subs.find(sf => normalizeName(sf.name) === target);
    if (found) return found;
    found = subs.find(sf => normalizeName(sf.name).includes(target) || target.includes(normalizeName(sf.name)));
    if (found) return found;
    for (const sf of subs) {
      const n = normalizeName(sf.name).replace(/\(.+?\)/g,'').replace(/[^a-z0-9 ]/g,'');
      if (n === target || n.includes(target) || target.includes(n)) return sf;
    }
    return null;
  }

  async function listFilesInFolderIdViaApi(folderId) {
    const resp = await apiGetJson(apiUrl('/api/drive/files?folderId=' + encodeURIComponent(folderId) + '&pageSize=200'));
    return resp.files || [];
  }

  // ----------------------------
  // UI helpers
  // ----------------------------
  function createSubjectItem(name, grade) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = name;
    a.href = '#';
    a.className = 'subject-item';
    a.dataset.subject = name;
    a.dataset.grade = grade;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      showSubjectDetailInline(name, grade, a);
    });
    li.appendChild(a);
    return li;
  }

  function populateSubjects() {
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
    const DEFAULTS = {
      6: ['Toán','Ngữ văn','Tiếng Anh','Khoa học tự nhiên','Lịch sử','Địa lí','Tin học','Công nghệ','GDCD'],
      7: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Công nghệ'],
      8: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Tin học'],
      9: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','GDQPAN'],
      10: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDCD'],
      11: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDQPAN'],
      12: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','Lịch sử'],
      common: ['Giáo dục công dân','Công nghệ','Khoa học tự nhiên','Giáo dục kinh tế và pháp luật']
    };
    for (const g of [6,7,8,9,10,11,12]) {
      const list = (window.subjectsByGrade && window.subjectsByGrade[g]) ? window.subjectsByGrade[g] : DEFAULTS[g];
      const container = gradeEls[g];
      if (!container) continue;
      container.innerHTML = '';
      list.forEach(s => container.appendChild(createSubjectItem(s, g)));
    }
    if (gradeEls.common) {
      gradeEls.common.innerHTML = '';
      const commonList = (window.subjectsByGrade && window.subjectsByGrade.common) ? window.subjectsByGrade.common : DEFAULTS.common;
      commonList.forEach(s => gradeEls.common.appendChild(createSubjectItem(s, 'common')));
    }
  }

  // ----------------------------
  // Main: show inline detail (static links + drive)
  // ----------------------------
  async function showSubjectDetailInline(name, grade, triggerElement) {
    const panel = triggerElement.closest('.grade-panel');
    if (!panel) return;
    const existing = panel.querySelector('.subject-detail-inline');
    if (existing) { existing.remove(); return; }
    document.querySelectorAll('.subject-detail-inline').forEach(n => n.remove());

    const detail = document.createElement('div');
    detail.className = 'subject-detail-inline';
    detail.style.marginTop = '12px';
    detail.style.padding = '12px';
    detail.style.border = '1px solid var(--border)';
    detail.style.borderRadius = '8px';
    detail.style.background = '#fff';
    detail.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                          <strong>${escapeHtml(name)} — Lớp ${escapeHtml(String(grade))}</strong>
                          <div class="muted">Liên kết tài liệu</div>
                        </div>
                        <div class="static-links" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;"></div>
                        <div class="drive-links muted">Đang tìm và tải từ Drive...</div>`;

    panel.appendChild(detail);

    // static links
    const staticWrap = detail.querySelector('.static-links');
    const staticLinks = ((SUBJECT_LINKS && SUBJECT_LINKS[grade]) ? SUBJECT_LINKS[grade][name] : null) || [];
    if (staticLinks.length) {
      staticLinks.forEach(it => {
        const a = document.createElement('a');
        a.className = 'btn';
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = it.label || it.url;
        staticWrap.appendChild(a);
      });
    } else {
      staticWrap.innerHTML = '<div class="muted">Không có liên kết hoc10.vn cho môn này.</div>';
    }

    const driveWrap = detail.querySelector('.drive-links');

    // First: try server-side convenience search endpoint
    try {
      driveWrap.innerHTML = '<div class="muted">Tìm file (server-side search)...</div>';
      const searchUrl = apiUrl('/api/drive/search') + `?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(name)}`;
      const sj = await fetchWithTimeout(searchUrl, {}, 12000).catch(e => { throw e; });
      if (sj.ok) {
        const sjjson = await sj.json().catch(()=>null);
        if (sjjson && sjjson.ok && Array.isArray(sjjson.files) && sjjson.files.length) {
          driveWrap.innerHTML = '<div style="margin-bottom:6px;"><strong>File từ Drive:</strong></div>';
          const fw = document.createElement('div');
          sjjson.files.forEach(f => {
            const btn = document.createElement('a');
            btn.className = 'btn-ghost';
            btn.style.display = 'inline-block';
            btn.style.margin = '6px 8px 6px 0';
            btn.textContent = f.name;
            btn.href = `/file.html?id=${encodeURIComponent(f.id)}&name=${encodeURIComponent(f.name)}`;
            btn.target = '_blank';
            btn.rel = 'noopener';
            fw.appendChild(btn);
          });
          driveWrap.appendChild(fw);
          return; // success via search endpoint
        } else if (sjjson && sjjson.ok && Array.isArray(sjjson.files) && sjjson.files.length === 0) {
          driveWrap.innerHTML = '<div class="muted">Server-side: folder found nhưng chưa có file.</div>';
          return;
        }
      }
    } catch (e) {
      console.warn('Search endpoint failed, falling back to folder flow:', e);
    }

    // Fallback: resolve via folder flow
    try {
      driveWrap.innerHTML = '<div class="muted">Tìm folder khối lớp trên Drive...</div>';
      const gradeFolderId = await resolveGradeFolderIdViaFolders(grade);
      if (!gradeFolderId) {
        driveWrap.innerHTML = '<div class="muted">Không xác định được folder khối lớp trên Drive. Vui lòng cấu hình window.DRIVE_GRADE_FOLDERS (client) hoặc mapping server-side.</div>';
        return;
      }

      driveWrap.innerHTML = '<div class="muted">Tìm folder môn trong khối lớp...</div>';
      const subjectFolder = await resolveSubjectFolderUnderGradeViaFolders(gradeFolderId, name);
      if (!subjectFolder) {
        driveWrap.innerHTML = '<div class="muted">Không tìm thấy folder môn tương ứng trong khối lớp. Dưới đây là danh sách folder con:</div>';
        const list = document.createElement('div'); list.style.marginTop='8px';
        const subs = await listSubfolders(gradeFolderId);
        (subs || []).forEach(sf => {
          const el = document.createElement('div'); el.className='muted'; el.textContent = `${sf.name} (id: ${sf.id})`; list.appendChild(el);
        });
        driveWrap.appendChild(list);
        return;
      }

      driveWrap.innerHTML = '<div class="muted">Lấy danh sách file trong folder môn...</div>';
      const files = await listFilesInFolderIdViaApi(subjectFolder.id);
      if (!files.length) {
        driveWrap.innerHTML = '<div class="muted">Folder môn tìm thấy nhưng chưa có file.</div>';
        return;
      }

      driveWrap.innerHTML = '<div style="margin-bottom:6px;"><strong>File từ Drive:</strong></div>';
      const fw = document.createElement('div');
      files.forEach(f => {
        const btn = document.createElement('a');
        btn.className = 'btn-ghost';
        btn.style.display = 'inline-block';
        btn.style.margin = '6px 8px 6px 0';
        btn.textContent = f.name;
        btn.href = `/file.html?id=${encodeURIComponent(f.id)}&name=${encodeURIComponent(f.name)}`;
        btn.target = '_blank';
        btn.rel = 'noopener';
        fw.appendChild(btn);
      });
      driveWrap.appendChild(fw);
    } catch (e) {
      console.error('Drive fallback error', e);
      driveWrap.innerHTML = `<div class="muted">Lỗi khi tải từ Drive: ${escapeHtml(String(e.message || e))}</div>`;
    }
  }

  // ----------------------------
  // Init subjects + search box
  // ----------------------------
  function initSubjects() {
    populateSubjects();
    const gs = document.getElementById('global-search');
    if (gs) {
      gs.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          const q = gs.value.trim().toLowerCase();
          if (!q) return;
          const anchors = Array.from(document.querySelectorAll('.subject-item'));
          const el = anchors.find(a => (a.dataset.subject || a.textContent || '').toLowerCase().includes(q));
          if (el) el.click();
          else alert('Không tìm thấy môn tương ứng.');
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSubjects);
  } else {
    initSubjects();
  }

  // exports for debug
  window.FP = window.FP || {};
  window.FP.clearDriveCache = clearDriveCache;
  window.FP.apiBase = API_BASE;
  window.FP.subjectLinks = SUBJECT_LINKS;

})();
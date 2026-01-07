// public/subject-links.js
// Full frontend script: subject mappings + drive helpers + auth integration + nav sync + defensive handlers.
// Paste/replace your existing public/subject-links.js with this file (backup original first).

(function () {
  /* ========================
      API base helper
      ======================== */
  const API_BASE = (window.API_BASE === undefined) ? '' : (window.API_BASE || '');
  function apiUrl(path) {
    if (!path) path = '/';
    if (path[0] !== '/') path = '/' + path;
    if (!API_BASE) return path;
    return API_BASE.replace(/\/$/, '') + path;
  }

  // Expose helper so other IIFEs can use it (fixes ReferenceError: apiUrl is not defined)
  window.apiUrl = apiUrl;
  window.FP = window.FP || {};
  window.FP.apiUrl = apiUrl;

  /* ========================
      Helpers
      ======================== */
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
      const text = await res.text().catch(()=>null);
      const err = new Error(`${res.status} ${res.statusText}${text?': '+text:''}`);
      err._status = res.status;
      err._body = text;
      throw err;
    }
    return res.json();
  }

  /* ========================
      FULL subject mapping (hoc10.vn)
      ======================== */
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

  /* ========================
      Drive helpers (fallback) - safe versions
      ======================== */
  const DRIVE_CACHE = { rootFolders: null, subfoldersByParent: new Map() };
  function clearDriveCache() { DRIVE_CACHE.rootFolders = null; DRIVE_CACHE.subfoldersByParent.clear(); }

  async function resolveGradeFolderIdViaFolders(grade) {
    if (!DRIVE_CACHE.rootFolders) {
      // This call uses apiGetJson which will throw if server returns non-JSON (and allow us to detect)
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

  // Safe listSubfolders: detect HTML response and provide helpful error
  async function listSubfolders(parentId) {
    if (DRIVE_CACHE.subfoldersByParent.has(parentId)) return DRIVE_CACHE.subfoldersByParent.get(parentId);

    const url = apiUrl('/api/drive/folders?parentId=' + encodeURIComponent(parentId));
    try {
      const res = await fetchWithTimeout(url, {}, 12000);
      const text = await res.text().catch(()=>null);
      const trimmed = (text || '').trim();

      // If server returned HTML (index.html), indicate that clearly
      if (trimmed && trimmed[0] === '<') {
        const err = new Error('Server returned HTML instead of JSON when listing subfolders');
        err._status = res.status;
        err._body = trimmed;
        throw err;
      }

      let json;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        const err = new Error('Failed to parse JSON from server response when listing subfolders');
        err._status = res.status;
        err._body = text;
        throw err;
      }

      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${res.statusText}`);
        err._status = res.status;
        err._body = text;
        throw err;
      }

      const arr = (json && json.folders) ? json.folders : [];
      DRIVE_CACHE.subfoldersByParent.set(parentId, arr);
      return arr;
    } catch (err) {
      throw err;
    }
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

  /* ========================
      UI: subjects and inline details
      ======================== */
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

    // static hoc10 links
    const staticWrap = detail.querySelector('.static-links');
    const staticLinks = (SUBJECT_LINKS && SUBJECT_LINKS[grade] && SUBJECT_LINKS[grade][name]) || [];
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

    // Drive flow: try server-side search first, then fallback folder flow
    const driveWrap = detail.querySelector('.drive-links');

    // 1) Try server-side convenience search endpoint
    try {
      driveWrap.innerHTML = '<div class="muted">Tìm file (server-side search)...</div>';
      const searchUrl = apiUrl('/api/drive/search') + `?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(name)}`;
      const resp = await fetchWithTimeout(searchUrl, {}, 12000);
      if (resp.ok) {
        const json = await resp.json().catch(()=>null);
        if (json && json.ok && Array.isArray(json.files)) {
          if (json.files.length === 0) {
            driveWrap.innerHTML = '<div class="muted">Server-side: folder tìm thấy nhưng chưa có file.</div>';
            return;
          }
          driveWrap.innerHTML = '<div style="margin-bottom:6px;"><strong>File từ Drive:</strong></div>';
          const fw = document.createElement('div');
          json.files.forEach(f => {
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
          return;
        }
      }
    } catch (e) {
      console.warn('Search endpoint failed; falling back to folder flow:', e);
    }
        // 2) Fallback: folder flow (grade folder -> subject folder -> files)
    try {
      driveWrap.innerHTML = '<div class="muted">Tìm folder khối lớp trên Drive...</div>';
      let gradeFolderId;
      try {
        gradeFolderId = await resolveGradeFolderIdViaFolders(grade);
      } catch (e) {
        // provide helpful message
        const serverBody = e._body ? String(e._body).slice(0, 300) : null;
        if (serverBody && serverBody[0] === '<') {
          driveWrap.innerHTML = `<div class="muted">Server trả HTML thay vì JSON khi tìm folder khối lớp. Có thể API chưa mount hoặc bạn gọi sai origin. Đầu response: ${escapeHtml(serverBody.slice(0,200))}</div>`;
        } else {
          driveWrap.innerHTML = `<div class="muted">Lỗi khi tìm folder khối lớp: ${escapeHtml(e.message || String(e))}</div>`;
        }
        return;
      }

      if (!gradeFolderId) {
        driveWrap.innerHTML = '<div class="muted">Không xác định được folder khối lớp trên Drive. Vui lòng cấu hình DRIVE_GRADE_FOLDERS_JSON hoặc window.DRIVE_GRADE_FOLDERS.</div>';
        return;
      }

      driveWrap.innerHTML = '<div class="muted">Tìm folder môn trong khối lớp...</div>';
      let subjectFolder;
      try {
        subjectFolder = await resolveSubjectFolderUnderGradeViaFolders(gradeFolderId, name);
      } catch (err) {
        const serverBody = err._body ? String(err._body).slice(0, 300) : null;
        if (serverBody && serverBody[0] === '<') {
          driveWrap.innerHTML = `<div class="muted">Server trả HTML thay vì JSON khi liệt kê folder môn. Đầu response: ${escapeHtml(serverBody.slice(0,200))}</div>`;
        } else {
          driveWrap.innerHTML = `<div class="muted">Lỗi khi lấy danh sách folder môn: ${escapeHtml(err.message || String(err))}</div>`;
        }
        return;
      }

      if (!subjectFolder) {
        try {
          const subs = await listSubfolders(gradeFolderId);
          driveWrap.innerHTML = '<div class="muted">Không tìm thấy folder môn tương ứng trong khối lớp. Dưới đây là folder con:</div>';
          const list = document.createElement('div'); list.style.marginTop='8px';
          (subs || []).forEach(sf => {
            const el = document.createElement('div');
            el.className = 'muted';
            el.textContent = `${sf.name} (id: ${sf.id})`;
            list.appendChild(el);
          });
          driveWrap.appendChild(list);
        } catch (err) {
          console.error('Error fetching subfolders for gradeFolderId', gradeFolderId, err);
          const serverBody = err._body ? String(err._body).slice(0, 300) : null;
          const statusInfo = err._status ? ` (status ${err._status})` : '';
          const msg = serverBody ? `Lỗi server${statusInfo}: ${serverBody}` : (`Lỗi khi lấy danh sách folder con: ${escapeHtml(err.message || String(err))}`);
          driveWrap.innerHTML = `<div class="muted">${escapeHtml(msg)}</div>`;
        }
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

  /* ========================
      Init
      ======================== */
  function initSubjects() {
    populateSubjects();
    const gs = document.getElementById('global-search');
    if (gs) {
      gs.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          document.dispatchEvent(new Event('fp:doFilter'));
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSubjects);
  } else {
    initSubjects();
  }

  /* ========================
      Expose for debug
      ======================== */
  window.FP = window.FP || {};
  window.FP.subjectLinks = SUBJECT_LINKS;
  window.FP.clearDriveCache = clearDriveCache;
  window.FP.apiBase = API_BASE;


})();
/* --- START: Inline advanced search (only "Lọc") --- */
(function(){
  // If header not present, skip
  const headerContainer = document.querySelector('.header-inner, .site-header .container, header .container') || document.querySelector('header');
  if (!headerContainer) return;

  // avoid duplicate injection
  if (document.getElementById('fp-advanced-search')) return;

  // CSS (injected)
  const css = `
  #fp-advanced-search { display:flex; gap:8px; align-items:center; margin-left:12px; }
  #fp-advanced-search select, #fp-advanced-search input { padding:6px 8px; border-radius:6px; border:1px solid #ddd; background:#fff; }
  #fp-advanced-search .fp-btn { padding:6px 10px; border-radius:6px; background:#fff; color:#333; border:1px solid #ddd; cursor:pointer; font-weight:600; }
  #fp-search-panel { position:fixed; left:0; right:0; top:64px; max-height:0; overflow:hidden; transition: max-height .28s ease, box-shadow .28s; z-index:1200;}
  #fp-search-panel.open { max-height:70vh; box-shadow: 0 8px 30px rgba(0,0,0,0.12); background: #faf7f6; padding:12px 0; }
  #fp-search-panel .fp-panel-inner { max-width:1100px; margin:0 auto; padding:12px; }
  .fp-result { background:#fff; border:1px solid #eee; padding:10px; border-radius:8px; margin-bottom:8px; }
  .fp-result a { font-weight:700; color:#111; text-decoration:none; }
  .fp-result .fp-snippet { color:#666; margin-top:6px; }
  .fp-panel-actions { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px; }
  .fp-close { background:#fff; border:1px solid #ddd; padding:6px 10px; border-radius:6px; cursor:pointer; }
  @media (max-width:800px){ #fp-advanced-search { display:block; margin-top:8px; } #fp-search-panel { top:92px; } }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

  // Build UI (only filter)
  const wrapper = document.createElement('div');
  wrapper.id = 'fp-advanced-search';
  wrapper.innerHTML = `
    <input id="fp-global-q" type="search" placeholder="Tìm (nhấn Enter)" aria-label="Tìm" style="min-width:200px" />
    <select id="fp-grade"><option value="">Khối</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option></select>
    <select id="fp-subject"><option value="">Môn</option></select>
    <button id="fp-filter-btn" class="fp-btn">Lọc</button>
  `;

  // Insert into header: try to place near nav or search input
  const nav = headerContainer.querySelector('.site-nav') || headerContainer.querySelector('.header-actions') || headerContainer;
  nav.appendChild(wrapper);

  // Panel for compact results (below header)
  let panel = document.getElementById('fp-search-panel-compact');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'fp-search-panel-compact';
    panel.style.display = 'none';
    panel.style.width = '100%';
    panel.style.background = '#faf7f6';
    panel.style.padding = '12px';
    panel.style.borderTop = '1px solid rgba(0,0,0,0.04)';
    panel.innerHTML = '<div id="fp-search-info-compact" class="muted">Chưa lọc</div><div id="fp-search-results-compact" style="margin-top:8px"></div>';
    const headerNode = document.querySelector('header') || document.body;
    if (headerNode && headerNode.parentNode) headerNode.parentNode.insertBefore(panel, headerNode.nextSibling);
  }

  // Helpers & wiring
  const existingGlobal = document.getElementById('global-search') || document.querySelector('input[placeholder*="Tìm"]') || document.querySelector('input[type="search"].global-search') || null;
  const localInput = document.getElementById('fp-global-q');
  if (existingGlobal && localInput) localInput.remove(); // reuse page's global input

  const qInput = existingGlobal || document.getElementById('fp-global-q') || null;
  const gradeSel = document.getElementById('fp-grade');
  const subjectSel = document.getElementById('fp-subject');
  const filterBtn = document.getElementById('fp-filter-btn');

  // ensure default All
  if (gradeSel) gradeSel.value = '';

  function populateSubjectsForGrade(g) {
    subjectSel.innerHTML = '<option value="">Môn</option>';
    if (!g) return;
    const map = (window.FP && window.FP.subjectLinks) ? window.FP.subjectLinks : null;
    if (map && map[g]) {
      const keys = Object.keys(map[g]).sort();
      keys.forEach(k => {
        const o = document.createElement('option'); o.value = k; o.textContent = k; subjectSel.appendChild(o);
      });
    } else {
      const fallback = {6:['Toán','Ngữ văn','Tiếng Anh'],7:['Toán','Ngữ văn','Tiếng Anh'],8:['Toán','Ngữ văn','Tiếng Anh'],9:['Toán','Ngữ văn','Tiếng Anh'],10:['Toán','Ngữ văn','Tiếng Anh'],11:['Toán','Ngữ văn','Tiếng Anh'],12:['Toán','Ngữ văn','Tiếng Anh']};
      (fallback[g]||[]).forEach(k => { const o=document.createElement('option'); o.value=k; o.textContent=k; subjectSel.appendChild(o); });
    }
  }

  gradeSel.addEventListener('change', ()=> populateSubjectsForGrade(gradeSel.value));

  function renderResultsCompact(json) {
    const resultsEl = document.getElementById('fp-search-results-compact');
    const infoEl = document.getElementById('fp-search-info-compact');
    resultsEl.innerHTML = '';
    const total = json && json.total ? json.total : 0;
    infoEl.textContent = 'Kết quả: ' + total;
    if (!json || !json.results || !json.results.length) {
      resultsEl.innerHTML = '<div class="muted" style="padding:12px">Không tìm thấy kết quả.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    json.results.forEach(it => {
      const d = document.createElement('div');
      d.style.background = '#fff';
      d.style.padding = '10px';
      d.style.border = '1px solid #eee';
      d.style.borderRadius = '8px';
      d.style.marginBottom = '8px';
      let href = '';
      if (it.url) {
        if (/^https?:\/\//i.test(it.url)) href = it.url;
        else href = '/file.html?id=' + encodeURIComponent(it.url) + (it.title ? ('&name=' + encodeURIComponent(it.title)) : '');
      }
      if (href) d.innerHTML = `<div style="font-weight:700"><a href="${href}" target="_blank" rel="noopener">${escapeHtml(it.title || it.filename || 'Tài liệu')}</a></div>`;
      else d.innerHTML = `<div style="font-weight:700">${escapeHtml(it.title || it.filename || 'Tài liệu')}</div>`;
      if (it.contentSnippet) d.innerHTML += `<div style="color:#666;margin-top:6px">${escapeHtml(it.contentSnippet)}</div>`;
      frag.appendChild(d);
    });
    resultsEl.appendChild(frag);
  }

  // performSearchUrl: return structured result, do not throw, include text/json
  async function performSearchUrl(url) {
    try {
      const r = await fetch(url, { credentials: 'same-origin' });
      const txt = await r.text().catch(()=>null);
      let parsed = null;
      try { parsed = txt ? JSON.parse(txt) : null; } catch(e) { parsed = null; }
      if (!r.ok) {
        console.error('server error body:', txt);
        return { ok: false, status: r.status, body: txt, json: parsed };
      }
      return { ok: true, status: r.status, body: txt, json: parsed };
    } catch (e) {
      console.error('request error', e);
      return { ok: false, error: e };
    }
  }

  // Unified filter action with retry when server reports missing class_id
  async function onFilterAction() {
    const q = qInput ? (qInput.value || '').trim() : '';
    const grade = gradeSel.value;
    const subject = subjectSel.value;
    if (!q && !grade && !subject) { alert('Nhập từ khoá hoặc chọn Khối/Môn để lọc'); return; }
    document.getElementById('fp-search-panel-compact').style.display = 'block';
    document.getElementById('fp-search-info-compact').textContent = q ? 'Đang tìm...' : 'Đang lọc...';

    function buildUrl(paramsObj) {
      const params = new URLSearchParams();
      if (paramsObj.q) params.set('q', paramsObj.q);
      params.set('page', String(paramsObj.page || 1));
      params.set('limit', String(paramsObj.limit || 50));
      if (paramsObj.grade) params.set('grade', paramsObj.grade);
      if (paramsObj.subject) params.set('subject', paramsObj.subject);
      const base = (window.API_BASE ? window.API_BASE.replace(/\/$/,'') : '');
      return (base ? base : '') + '/api/search?' + params.toString();
    }

    const params0 = { q: q || '', page:1, limit:50, grade: grade || '', subject: subject || '' };
    const url0 = buildUrl(params0);
    const resp0 = await performSearchUrl(url0);

    if (resp0.ok) {
      renderResultsCompact(resp0.json || { total:0, results:[] });
      return;
    }

    const bodyText = String(resp0.body || '').toLowerCase();
    if (resp0.status === 500 && bodyText.includes('class_id') && bodyText.includes('does not exist')) {
      console.warn('[FP] server missing class_id; retry without grade');
      document.getElementById('fp-search-info-compact').textContent = 'Server không hỗ trợ lọc theo Khối → Thử lại không dùng Khối...';
      const params1 = { q: q || '', page:1, limit:50, subject: subject || '' };
      const url1 = buildUrl(params1);
      const resp1 = await performSearchUrl(url1);
      if (resp1.ok) {
        const info = document.getElementById('fp-search-info-compact');
        if (info) info.textContent = `Kết quả (Khối bị bỏ): ${resp1.json && resp1.json.total ? resp1.json.total : 0}`;
        renderResultsCompact(resp1.json || { total:0, results:[] });
        return;
      } else {
        console.error('[FP] retry without grade also failed', resp1);
        document.getElementById('fp-search-info-compact').textContent = 'Lỗi server (sau khi thử bỏ Khối). Xem console để biết chi tiết.';
        return;
      }
    }

    console.error('[FP] search/filter failed', resp0);
    document.getElementById('fp-search-info-compact').textContent = 'Lỗi server. Kiểm tra console (F12) để biết chi tiết.';
  }

  filterBtn.addEventListener('click', function(e){ e.preventDefault(); onFilterAction(); });
  if (qInput) qInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); onFilterAction(); } });
  const pageGlobal = document.getElementById('global-search') || document.querySelector('input[placeholder*="Tìm"]');
  if (pageGlobal) pageGlobal.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); onFilterAction(); } });

  // support event from initSubjects
  document.addEventListener('fp:doFilter', function(){ onFilterAction(); });

  // init from URL params
  (function initFromQuery(){
    try {
      const up = new URL(window.location.href).searchParams;
      const q0 = up.get('q'); const g0 = up.get('grade'); const s0 = up.get('subject');
      if (g0) { gradeSel.value = g0; populateSubjectsForGrade(g0); }
      if (s0) {
        if (!Array.from(subjectSel.options).find(o=>o.value===s0)) {
          const o = document.createElement('option'); o.value = s0; o.textContent = s0; subjectSel.appendChild(o);
        }
        subjectSel.value = s0;
      }
      if (q0) {
        if (pageGlobal) pageGlobal.value = q0;
        else if (qInput) qInput.value = q0;
        setTimeout(()=> onFilterAction(), 300);
      }
    } catch(e){}
  })();

  /* ========================
     Auth integration — unified login/register/logout (no extra files)
     This block handles AJAX login/register, dispatches events,
     and is resilient to extension errors.
     ======================== */
  (function(){
    if (window._fpAuthUnifiedInjected) return;
    window._fpAuthUnifiedInjected = true;

    async function callJson(url, opts={}) {
      try {
        opts = opts || {};
        // default to include credentials so session cookies work
        opts.credentials = 'include';
        if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
          opts.headers = Object.assign({}, opts.headers || {}, {'Content-Type':'application/json'});
          opts.body = JSON.stringify(opts.body);
        }
        // if caller passed an absolute URL, use it; otherwise prefix with apiUrl()
        const fullUrl = (/^https?:\/\//i).test(url) ? url : apiUrl(url);
        const res = await fetch(fullUrl, opts);
        const txt = await res.text().catch(()=>null);
        try { return { ok: res.ok, status: res.status, json: txt ? JSON.parse(txt) : null, text: txt }; } catch(e) { return { ok: res.ok, status: res.status, json: null, text: txt }; }
      } catch (err) {
        console.error('[FP] callJson error', err);
        return { ok: false, error: err };
      }
    }

    function safe(fn) {
      return function (ev) {
        try {
          return fn.call(this, ev);
        } catch (err) {
          console.error('[FP] handler caught error (likely extension):', err);
          return;
        }
      };
    }

    // selectors: adjust if your HTML differs
    const LOGIN_FORM = document.getElementById('login-form');
    const REGISTER_FORM = document.getElementById('register-form');
    const NAV_OUT = document.querySelectorAll('.nav-logged-out');
    const NAV_IN = document.querySelectorAll('.nav-logged-in');
    const NAV_USER = document.querySelector('.nav-username');

    function showLoggedIn(user) {
      try {
        if (NAV_OUT) NAV_OUT.forEach(n=>n.style.display='none');
        if (NAV_IN && NAV_IN.length) NAV_IN.forEach(n=>n.style.display='');
        if (NAV_USER && user) NAV_USER.textContent = user.name || user.username || '';
        // fallback: if no nav-in area present, inject a simple display
        if ((!NAV_IN || NAV_IN.length===0) && user) {
          const header = document.querySelector('header') || document.querySelector('nav') || document.body;
          let inj = header.querySelector('.fp-injected-auth');
          if (!inj) {
            inj = document.createElement('div');
            inj.className = 'fp-injected-auth';
            inj.style.display = 'inline-flex';
            inj.style.alignItems = 'center';
            inj.style.gap = '8px';
            header.appendChild(inj);
          }
          inj.innerHTML = `<span class="nav-username" style="font-weight:600">${user.name||user.username||'Người dùng'}</span><a href="#" id="logout-btn" style="margin-left:8px;color:#c94">Đăng xuất</a>`;
        }
      } catch(e){ console.error('[FP] showLoggedIn', e); }
    }

    function showLoggedOut() {
      try {
        if (NAV_OUT) NAV_OUT.forEach(n=>n.style.display='');
        if (NAV_IN) NAV_IN.forEach(n=>n.style.display='none');
        if (NAV_USER) NAV_USER.textContent = '';
        const inj = document.querySelector('.fp-injected-auth'); if (inj) inj.remove();
      } catch(e){ console.error('[FP] showLoggedOut', e); }
    }

    // login form submit -> AJAX
    if (LOGIN_FORM) {
      LOGIN_FORM.addEventListener('submit', safe(async function(e){
        e.preventDefault();
        const f = new FormData(LOGIN_FORM);
        const payload = { username: (f.get('username')||f.get('email')||''), password: f.get('password')||'' };
        const btn = LOGIN_FORM.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
        // use callJson with path; callJson prefixes API_BASE if set
        const r = await callJson('/api/login', { method: 'POST', body: payload });
        if (btn) btn.disabled = false;
        if (r.ok && r.json && r.json.ok) {
          // Nếu là admin => chuyển sang trang admin.html
          try {
            if (r.json.user && r.json.user.role === 'admin') {
              window.location.href = '/admin.html';
              return;
            }
          } catch(e){ /* ignore */ }
          showLoggedIn(r.json.user);
          document.dispatchEvent(new CustomEvent('user:loggedin',{detail:r.json.user}));
          if (typeof closeLoginModal === 'function') try { closeLoginModal(); } catch(e){}
        } else {
          const msg = (r.json && (r.json.error || r.json.message)) ? (r.json.error || r.json.message) : (r.text||'Đăng nhập thất bại');
          alert('Đăng nhập thất bại: ' + msg);
        }
      }));
    }

    // register form submit -> AJAX
    if (REGISTER_FORM) {
      REGISTER_FORM.addEventListener('submit', safe(async function(e){
        e.preventDefault();
        const f = new FormData(REGISTER_FORM);
        const payload = { username: f.get('username'), password: f.get('password'), name: f.get('name') || null, email: f.get('email') || null };
        const btn = REGISTER_FORM.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
        const r = await callJson('/api/register', { method: 'POST', body: payload });
        if (btn) btn.disabled = false;
        if (r.ok && r.json && r.json.ok) {
          showLoggedIn(r.json.user);
          document.dispatchEvent(new CustomEvent('user:loggedin',{detail:r.json.user}));
          if (typeof closeRegisterModal === 'function') try { closeRegisterModal(); } catch(e){}
        } else {
          const msg = (r.json && (r.json.error || r.json.message)) ? (r.json.error || r.json.message) : (r.text||'Đăng ký thất bại');
          alert('Đăng ký thất bại: ' + msg);
        }
      }));
    }

    // logout handler (delegated)
    document.addEventListener('click', safe(async function(e){
      const t = e.target.closest && (e.target.closest('#logout-btn') || e.target.closest('.logout-btn') || e.target.closest('.fp-logout'));
      if (!t) return;
      e.preventDefault();
      if (!confirm('Bạn muốn đăng xuất?')) return;
      const r = await callJson('/api/logout', { method: 'POST' });
      if (r.ok && r.json && r.json.ok) {
        showLoggedOut();
        document.dispatchEvent(new CustomEvent('user:loggedout'));
      } else {
        const err = (r.json && (r.json.error || r.json.message)) || r.text || 'Đăng xuất thất bại';
        alert('Đăng xuất thất bại: ' + err);
      }
    }));

    // initial check
    (async function(){
      try {
        const r = await callJson('/api/me', { method: 'GET' });
        if (r.ok && r.json && r.json.ok && r.json.user) showLoggedIn(r.json.user);
        else showLoggedOut();
      } catch (e) {
        console.warn('auth init error', e);
        showLoggedOut();
      }
    })();

  })();

  /* ========================
     NAV AUTH SYNC (append / ensure header links update)
     This will hide #link-login and #link-register and show #link-logout when logged in.
     Works with the server /api/me endpoint and with the auth handlers above.
     ======================== */
  (function(){
    if (window._fpNavAuthSync) return;
    window._fpNavAuthSync = true;

    async function callApiJson(url, opts = {}) {
      try {
        opts = Object.assign({}, opts);
        opts.credentials = 'include';
        if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
          opts.headers = Object.assign({}, opts.headers || {}, {'Content-Type':'application/json'});
          opts.body = JSON.stringify(opts.body);
        }
        // ensure apiUrl prefix behavior for relative paths
        const fullUrl = (/^https?:\/\//i).test(url) ? url : apiUrl(url);
        const res = await fetch(fullUrl, opts);
        const text = await res.text().catch(()=>null);
        try { return { ok: res.ok, status: res.status, json: text ? JSON.parse(text) : null, text }; }
        catch(e){ return { ok: res.ok, status: res.status, json: null, text }; }
      } catch (err) {
        console.error('[FP] callApiJson error', err);
        return { ok: false, error: err };
      }
    }

    function getEls() {
      return {
        loginLink: document.getElementById('link-login'),
        registerLink: document.getElementById('link-register'),
        logoutLink: document.getElementById('link-logout')
      };
    }

    function showLoggedIn(user) {
      try {
        const { loginLink, registerLink, logoutLink } = getEls();
        if (loginLink) loginLink.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
        if (logoutLink) {
          logoutLink.style.display = '';
          logoutLink.textContent = user && (user.name || user.username) ? `Đăng xuất (${user.name || user.username})` : 'Đăng xuất';
          logoutLink.setAttribute('href', '#');
        }
      } catch (e) { console.error(e); }
    }

    function showLoggedOut() {
      try {
        const { loginLink, registerLink, logoutLink } = getEls();
        if (loginLink) loginLink.style.display = '';
        if (registerLink) registerLink.style.display = '';
        if (logoutLink) logoutLink.style.display = 'none';
      } catch (e) { console.error(e); }
    }

    async function refreshAuthState() {
      const r = await callApiJson('/api/me', { method: 'GET' });
      if (r.ok && r.json && r.json.ok && r.json.user) {
        showLoggedIn(r.json.user);
        return;
      } else {
        showLoggedOut();
      }
    }

    document.addEventListener('click', async function(e){
      const t = e.target && e.target.closest && (e.target.closest('#link-logout') || e.target.closest('a#link-logout'));
      if (!t) return;
      e.preventDefault();
      if (!confirm('Bạn muốn đăng xuất?')) return;
      const r = await callApiJson('/api/logout', { method: 'POST' });
      if (r.ok && ((r.json && r.json.ok) || r.status === 200)) {
        showLoggedOut();
        document.dispatchEvent(new CustomEvent('user:loggedout'));
      } else {
        const err = (r.json && (r.json.error || r.json.message)) || r.text || 'Đăng xuất thất bại';
        alert('Đăng xuất thất bại: ' + err);
      }
    }, true);

    document.addEventListener('user:loggedin', function(ev){
      const user = ev && ev.detail ? ev.detail : null;
      if (user) showLoggedIn(user);
    });
    document.addEventListener('user:loggedout', showLoggedOut);

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshAuthState);
    else setTimeout(refreshAuthState, 30);
  })();

  /* ========================
     Force navigation for login/register links (defensive)
     If other scripts block navigation, this listener will force it.
     ======================== */
  (function(){
    if (window._fpForceNavInstalled) return;
    window._fpForceNavInstalled = true;

    function safeAssign(href) {
      try { window.location.assign(href); } catch(e) { try { window.location.href = href; } catch(e){} }
    }

    function bindForceNav(selector) {
      document.addEventListener('click', function(ev){
        try {
          const t = ev.target && ev.target.closest && ev.target.closest(selector);
          if (!t) return;
          if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button === 1) return;
          ev.preventDefault();
          ev.stopPropagation && ev.stopPropagation();
          const href = t.getAttribute('href') || t.dataset.href;
          if (!href) return;
          safeAssign(href);
        } catch (err) { console.error('[FP] force-nav handler error', err); }
      }, true);
    }

    // Bind common selectors used in your template
    bindForceNav('#link-login');      // <a id="link-login" href="login.html">
    bindForceNav('#link-register');   // <a id="link-register" href="register.html">
    bindForceNav('a.nav-link[href$="login.html"]');
    bindForceNav('a.nav-link[href$="register.html"]');

    // Also ensure keyboard Enter on focused links works
    document.addEventListener('keydown', function(ev){
      try {
        if (ev.key !== 'Enter') return;
        const el = document.activeElement;
        if (!el) return;
        if (el.matches && (el.matches('#link-login') || el.matches('#link-register') || (el.matches('a.nav-link') && (el.getAttribute('href')||'').includes('login')) || (el.matches('a.nav-link') && (el.getAttribute('href')||'').includes('register')))) {
          ev.preventDefault();
          const href = el.getAttribute('href') || el.dataset.href;
          if (href) safeAssign(href);
        }
      } catch(e) { console.error(e); }
    }, true);

    // Defensive: if nav links are replaced/added later, auto-bind by mutation observer
    const obs = new MutationObserver((mutations) => {
      try {
        for (const m of mutations) {
          if (m.addedNodes && m.addedNodes.length) {
            // nothing extra required, our delegated listeners will catch them
          }
        }
      } catch(e){}
    });
    obs.observe(document.documentElement || document.body, { childList: true, subtree: true });

  })();

})();
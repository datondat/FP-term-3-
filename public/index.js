/* public/index.js
   Full runtime with booksMap (subject -> resource links).
   - booksMap contains the per-subject links you pasted.
   - lookup accepts multiple key formats: "grade|Subject" (your map),
     "Subject::grade" (previous format) and "Subject::" (common).
   - Other behaviours: populateSubjects, showSubjectDetail, search/autocomplete,
     loadUser, doLogout, installLogoutButtons, etc.
*/
(function () {
  'use strict';

  // --- Data: subject lists (names only) ---
  const classSubjects = {
    6: ['Toán','Ngữ văn','Tiếng Anh','Khoa học tự nhiên','Lịch sử','Địa lí','Tin học','Công nghệ','GDCD'],
    7: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Công nghệ'],
    8: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Tin học'],
    9: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','GDQPAN'],
    10: ['Toán (Tự chọn/Chuyên)','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDCD'],
    11: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDQPAN'],
    12: ['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','Lịch sử & Địa lí'],
    common: ['Giáo dục công dân','Công nghệ','Khoa học tự nhiên','Giáo dục kinh tế và pháp luật']
  };

  // --- booksMap: resources you pasted (kept as-is) ---
  const booksMap = {
    /* NGỮ VĂN */
    '6|Ngữ văn': [
      { label: 'SGK Ngữ văn 6 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-1/1/22/0/' },
      { label: 'SGK Ngữ văn 6 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-2/1/23/0/' },
      { label: 'SBT Ngữ văn 6 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-1/5/50/0/' },
      { label: 'SBT Ngữ văn 6 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-2/5/174/0/' }
    ],
    '7|Ngữ văn': [
      { label: 'SGK Ngữ văn 7 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-7-tap-1/1/139/0/' },
      { label: 'SGK Ngữ văn 7 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-7-tap-2/1/140/0/' },
      { label: 'SBT Ngữ văn 7 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-7-tap-1/5/282/0/' },
      { label: 'SBT Ngữ văn 7 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-7-tap-2/5/283/0/' }
    ],
    '8|Ngữ văn': [
      { label: 'SGK Ngữ văn 8 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-8-tap-1/1/412/0/' },
      { label: 'SGK Ngữ văn 8 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-8-tap-2/1/414/0/' },
      { label: 'SBT Ngữ văn 8 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-8-tap-1/5/422/0/' },
      { label: 'SBT Ngữ văn 8 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-8-tap-2/5/423/0/' }
    ],
    '9|Ngữ văn': [
      { label: 'SGK Ngữ văn 9 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-9-tap-1/1/697/0/' },
      { label: 'SGK Ngữ văn 9 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-9-tap-2/1/698/0/' },
      { label: 'SBT Ngữ văn 9 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-9-tap-1/5/713/0/' },
      { label: 'SBT Ngữ văn 9 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-9-tap-2/5/714/0/' }
    ],
    '10|Ngữ văn': [
      { label: 'SGK Ngữ văn 10 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-10-tap-1/1/153/0/' },
      { label: 'SGK Ngữ văn 10 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-10-tap-2/1/154/0/' },
      { label: 'Chuyên đề Ngữ văn 10', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-ngu-van-10/1/199/0/' },
      { label: 'SBT Ngữ văn 10 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-10-tap-1/5/288/0/' },
      { label: 'SBT Ngữ văn 10 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-10-tap-2/5/289/0/' }
    ],
    '11|Ngữ văn': [
      { label: 'SGK Ngữ văn 11 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-11-tap-1/1/444/0/' },
      { label: 'SGK Ngữ văn 11 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-11-tap-2/1/445/0/' },
      { label: 'Chuyên đề Ngữ văn 11', url: 'https://www.hoc10.vn/doc-sach/cd-ngu-van-11/1/395/0/' },
      { label: 'SBT Ngữ văn 11 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-11-tap-1/5/430/0/' },
      { label: 'SBT Ngữ văn 11 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-11-tap-2/5/432/0/' }
    ],
    '12|Ngữ văn': [
      { label: 'SGK Ngữ văn 12 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-12-tap-1/1/719/0/' },
      { label: 'SGK Ngữ văn 12 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-12-tap-2/1/720/0/' },
      { label: 'Chuyên đề Ngữ văn 12', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-ngu-van-12/1/740/0/' },
      { label: 'SBT Ngữ văn 12 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-12-tap-1/5/752/0/' },
      { label: 'SBT Ngữ văn 12 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-12-tap-2/5/753/0/' }
    ],

    /* TOÁN */
    '6|Toán': [
      { label: 'SGK Toán 6 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/toan-6-1/1/24/0/' },
      { label: 'SGK Toán 6 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/toan-6-2/1/35/0/' },
      { label: 'SBT Toán 6 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-6-tap-1/5/52/0/' },
      { label: 'SBT Toán 6 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-6-tap-2/5/178/0/' }
    ],
    '7|Toán': [
      { label: 'SGK Toán 7 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/toan-7-tap-1/1/141/0/' },
      { label: 'SGK Toán 7 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/toan-7-tap-2/1/142/0/' },
      { label: 'SBT Toán 7 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-7-tap-1/5/284/0/' },
      { label: 'SBT Toán 7 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-7-tap-2/5/285/0/' }
    ],
    '8|Toán': [
      { label: 'SGK Toán 8 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/toan-8-tap-1/1/417/0/' },
      { label: 'SGK Toán 8 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/toan-8-tap-2/1/419/0/' },
      { label: 'SBT Toán 8 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-8-tap-1/5/425/0/' },
      { label: 'SBT Toán 8 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-8-tap-2/5/427/0/' }
    ],
    '9|Toán': [
      { label: 'SGK Toán 9 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/toan-9-tap-1/1/699/0/' },
      { label: 'SGK Toán 9 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/toan-9-tap-2/1/700/0/' },
      { label: 'SBT Toán 9 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-9-tap-1/5/715/0/' },
      { label: 'SBT Toán 9 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-9-tap-2/5/716/0/' }
    ],
    '10|Toán (Tự chọn/Chuyên)': [
      { label: 'SGK Toán 10 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/toan-10-tap-1/1/155/0/' },
      { label: 'SGK Toán 10 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/toan-10-tap-2/1/156/0/' },
      { label: 'Chuyên đề Toán 10', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-toan-10/1/200/0/' },
      { label: 'SBT Toán 10 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-10-tap-1/5/286/0/' },
      { label: 'SBT Toán 10 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-10-tap-2/5/287/0/' }
    ],
    '11|Toán': [
      { label: 'SGK Toán 11 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/toan-11-tap-1/1/446/0/' },
      { label: 'SGK Toán 11 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/toan-11-tap-2/1/447/0/' },
      { label: 'Chuyên đề Toán 11', url: 'https://www.hoc10.vn/doc-sach/cd-toan-11/1/396/0/' },
      { label: 'SBT Toán 11 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-11-tap-1/5/433/0/' },
      { label: 'SBT Toán 11 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-11-tap-2/5/435/0/' }
    ],
    '12|Toán': [
      { label: 'SGK Toán 12 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/toan-12-tap-1/1/721/0/' },
      { label: 'SGK Toán 12 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/toan-12-tap-2/1/722/0/' },
      { label: 'Chuyên đề Toán 12', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-toan-12/1/741/0/' },
      { label: 'SBT Toán 12 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-12-tap-1/5/754/0/' },
      { label: 'SBT Toán 12 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-12-tap-2/5/755/0/' }
    ],

    /* TIẾNG ANH */
    '6|Tiếng Anh': [
      { label: 'SGK Tiếng Anh 6', url: 'https://www.hoc10.vn/doc-sach/tieng-anh-6/1/30/0/' },
      { label: 'SBT Tiếng Anh 6', url: 'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-6/5/82/0/' }
    ],
    '7|Tiếng Anh': [
      { label: 'SGK Tiếng Anh 7', url: 'https://www.hoc10.vn/doc-sach/tieng-anh-7/1/152/0/' },
      { label: 'SBT Tiếng Anh 7', url: 'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-7/5/275/0/' }
    ],
    '8|Tiếng Anh': [
      { label: 'SGK Tiếng Anh 8', url: 'https://www.hoc10.vn/doc-sach/tieng-anh-8/1/589/0/' },
      { label: 'SBT Tiếng Anh 8', url: 'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-8/5/588/0/' }
    ],
    '9|Tiếng Anh': [
      { label: 'SGK Tiếng Anh 9', url: 'https://www.hoc10.vn/doc-sach/tieng-anh-9/1/800/0/' },
      { label: 'SBT Tiếng Anh 9', url: 'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-9/5/803/0/' }
    ],
    '10|Tiếng Anh': [
      { label: 'SGK Tiếng Anh 10', url: 'https://www.hoc10.vn/doc-sach/tieng-anh-10/1/173/0/' },
      { label: 'SBT Tiếng Anh 10', url: 'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-10/5/212/0/' }
    ],
    '11|Tiếng Anh': [
      { label: 'SGK Tiếng Anh 11', url: 'https://www.hoc10.vn/doc-sach/tieng-anh-11/1/592/0/' },
      { label: 'SBT Tiếng Anh 11', url: 'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-11/5/591/0/' }
    ],
    '12|Tiếng Anh': [
      { label: 'SGK Tiếng Anh 12', url: 'https://www.hoc10.vn/doc-sach/tieng-anh-12/1/801/0/' },
      { label: 'SBT Tiếng Anh 12', url: 'https://www.hoc10.vn/doc-sach/sbt-tieng-anh-12/5/804/0/' }
    ],

    /* TIN HỌC */
    '6|Tin học': [ { label: 'SGK Tin học 6', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-6/1/28/0/' } ],
    '7|Tin học': [ { label: 'SGK Tin học 7', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-7/1/147/0/' } ],
    '8|Tin học': [ { label: 'SGK Tin học 8', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-8/1/421/0/' } ],
    '9|Tin học': [ { label: 'SGK Tin học 9', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-9/1/701/0/' } ],
    '10|Tin học': [ { label: 'SGK Tin học 10', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-10/1/164/0/' } ],
    '11|Tin học': [
      { label: 'SGK Tin học 11 - Khoa học máy tính', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-11-khoa-hoc-may-tinh/1/387/0/' },
      { label: 'SGK Tin học 11 - Ứng dụng', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-11-tin-hoc-ung-dung/1/386/0/' },
      { label: 'Chuyên đề Tin học 11 - Khoa học máy tính', url: 'https://www.hoc10.vn/doc-sach/cd-tin-hoc-11-khoa-hoc-may-tinh/1/410/0/' },
      { label: 'Chuyên đề Tin học 11 - Ứng dụng', url: 'https://www.hoc10.vn/doc-sach/cd-tin-hoc-11-tin-hoc-ung-dung/1/408/0/' }
    ],
    '12|Tin học': [
      { label: 'SGK Tin học 12 - Ứng dụng', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-12-tin-hoc-ung-dung/1/737/0/' },
      { label: 'SGK Tin học 12 - Khoa học máy tính', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-12-khoa-hoc-may-tinh/1/738/0/' },
      { label: 'Chuyên đề Tin học 12 - Ứng dụng', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-tin-hoc-12-tin-hoc-ung-dung/1/749/0/' },
      { label: 'Chuyên đề Tin học 12 - Khoa học máy tính', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-tin-hoc-12-khoa-hoc-may-tinh/1/750/0/' }
    ]
    // if you want more subjects, we can add additional keys here
  };

  // expose for debug
  window.BOOKS_MAP = booksMap;

  // --- Helpers ---
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function debounce(fn, wait) { let t; return function(...args){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,args), wait); }; }

  // --- Populate subject lists (names only) ---
  function populateSubjects(){
    Object.keys(classSubjects).forEach(key => {
      const id = (/^\d+$/.test(key) ? 'grade-' + key : 'grade-common');
      const ul = document.getElementById(id);
      if(!ul) return;
      ul.innerHTML = '';
      classSubjects[key].forEach(sub => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'subject';
        a.textContent = sub;
        a.dataset.subject = sub;
        a.dataset.grade = /^\d+$/.test(key) ? key : '';
        li.appendChild(a);
        ul.appendChild(li);
      });
    });
  }

  // --- Resource lookup (supports multiple key formats) ---
  function getResourcesFor(subject, grade){
    // try grade|Subject (your provided format)
    const keyA = `${grade}|${subject}`;
    if (booksMap[keyA]) return booksMap[keyA];

    // try Subject::grade (older format)
    const keyB = `${subject}::${grade || ''}`;
    if (booksMap[keyB]) return booksMap[keyB];

    // try Subject:: (common)
    const keyC = `${subject}::`;
    if (booksMap[keyC]) return booksMap[keyC];

    // also try subject as-is key (just in case)
    if (booksMap[subject]) return booksMap[subject];

    return null;
  }

  // --- Subject detail rendering ---
  const detailWrap = $('#subject-detail');
  const detailTitle = $('#subject-title');
  const detailDesc = $('#subject-desc');
  const detailBooks = $('#subject-books');
  function hoc10Search(subject, grade){ return 'https://www.hoc10.vn/tim-kiem?q=' + encodeURIComponent(subject + (grade ? ' ' + grade : '')); }

  function showSubjectDetail(subject, grade){
    if(!detailWrap) return;
    detailTitle.textContent = subject;
    detailDesc.textContent = `Tài liệu tham khảo và liên kết cho ${subject}${grade ? ' (Lớp ' + grade + ')' : ''}.`;
    detailBooks.innerHTML = '';

    const resources = getResourcesFor(subject, grade);
    if(resources && resources.length){
      const ul = document.createElement('ul');
      ul.className = 'resource-list';
      resources.forEach(r => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = r.url;
        a.textContent = r.label || r.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        li.appendChild(a);
        ul.appendChild(li);
      });
      detailBooks.appendChild(ul);
    } else {
      const a = document.createElement('a');
      a.className = 'book-link';
      a.href = hoc10Search(subject, grade);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = `Tìm sách trên hoc10 cho ${subject}${grade ? ' — Lớp ' + grade : ''}`;
      detailBooks.appendChild(a);
    }

    detailWrap.style.display = 'block';
    try{ detailWrap.scrollIntoView({ behavior:'smooth', block:'start' }); } catch(e){}
  }

  // --- Delegation for subject clicks ---
  function installSubjectDelegation(){
    const container = document.querySelector('.subjects-view') || document.body;
    if(container._delegationInstalled) return;
    container.addEventListener('click', function(e){
      let el = e.target;
      while(el && el !== container){
        if(el.matches && el.matches('a.subject')){
          e.preventDefault();
          const subject = el.dataset.subject || el.textContent.trim();
          const grade = el.dataset.grade || '';
          showSubjectDetail(subject, grade);
          return;
        }
        el = el.parentNode;
      }
    }, false);
    container._delegationInstalled = true;
  }

  // --- (rest of runtime: autocomplete/search/login/logout) ---
  // Minimal autocomplete + search + inline login + auth helpers (kept concise)
  const searchForm = $('.search-form');
  const inputEl = searchForm ? searchForm.querySelector('.search-input') : null;

  // --- Autocomplete (light) ---
  const dropdownId = 'searchAutocomplete';
  let dropdown = document.getElementById(dropdownId);
  if(!dropdown){ dropdown = document.createElement('div'); dropdown.id = dropdownId; dropdown.className = 'search-autocomplete hidden'; document.body.appendChild(dropdown); }
  let suggestions = [], activeIndex = -1;
  function positionDropdown(){ if(!inputEl) return; const rect = inputEl.getBoundingClientRect(); dropdown.style.left = (rect.left+window.scrollX)+'px'; dropdown.style.top=(rect.bottom+window.scrollY+6)+'px'; dropdown.style.width = Math.max(240, rect.width) + 'px'; }
  function showDropdown(items){ suggestions = items || []; activeIndex = -1; dropdown.innerHTML=''; if(!items || !items.length){ dropdown.classList.add('hidden'); return;} const ul=document.createElement('ul'); ul.className='autocomplete-list'; items.forEach((it,i)=>{ const li=document.createElement('li'); li.className='autocomplete-item'; li.innerHTML = `<div class="title">${escapeHtml(it.title||it.name)}</div><div class="meta">${escapeHtml(it.meta||'')}</div>`; li.addEventListener('click', ()=>selectSuggestion(i)); ul.appendChild(li); }); dropdown.appendChild(ul); dropdown.classList.remove('hidden'); positionDropdown(); }
  function hideDropdown(){ dropdown.classList.add('hidden'); suggestions=[]; activeIndex=-1; }
  function selectSuggestion(i){ const it = suggestions[i]; if(!it) return; if(it.url) window.location.href = it.url; else { if(inputEl) inputEl.value = it.title||it.name||''; hideDropdown(); doSearch(inputEl.value); } }
  function highlightActive(){ const items = dropdown.querySelectorAll('.autocomplete-item'); items.forEach((el,i)=> el.classList.toggle('active', i===activeIndex)); }

  if(inputEl){
    inputEl.addEventListener('input', debounce(function(e){
      const q = e.target.value || '';
      if(!q){ hideDropdown(); return; }
      const all = [];
      Object.values(classSubjects).forEach(arr => arr.forEach(s => all.push(s)));
      const filtered = [...new Set(all)].filter(s => s.toLowerCase().includes(q.toLowerCase())).slice(0,6).map(x => ({ title: x, meta: '' }));
      showDropdown(filtered);
    }, 150));
    window.addEventListener('resize', positionDropdown);
    window.addEventListener('scroll', positionDropdown);
    inputEl.addEventListener('keydown', (e)=>{
      if(dropdown.classList.contains('hidden')) return;
      const len = suggestions.length||0;
      if(e.key==='ArrowDown'){ e.preventDefault(); activeIndex=(activeIndex+1)%len; highlightActive(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); activeIndex=(activeIndex-1+len)%len; highlightActive(); }
      else if(e.key==='Enter'){ if(activeIndex>=0){ e.preventDefault(); selectSuggestion(activeIndex); } else { e.preventDefault(); doSearch(inputEl.value||''); } }
      else if(e.key==='Escape'){ hideDropdown(); }
    });
  }
  document.addEventListener('click', (e)=>{ if(!dropdown.contains(e.target) && e.target !== inputEl) hideDropdown(); });

  // --- Results (API) ---
  const resultsContainerId='searchResultsContainer';
  let resultsContainer = document.getElementById(resultsContainerId);
  if(!resultsContainer){ resultsContainer = document.createElement('section'); resultsContainer.id = resultsContainerId; resultsContainer.className='search-results'; const mainNode=document.querySelector('main')||null; document.body.insertBefore(resultsContainer, mainNode); }
  async function doSearch(q,page=1){ if(!q){ resultsContainer.innerHTML='<p class="no-results">Không tìm thấy kết quả.</p>'; return; } resultsContainer.innerHTML='<p class="loading">Đang tìm kiếm…</p>'; try{ const r = await fetch('/api/search?q='+encodeURIComponent(q)+'&page='+page+'&limit=10',{ credentials:'include' }); if(!r.ok){ resultsContainer.innerHTML=`<p class="error">Lỗi khi tìm kiếm: ${r.status} ${r.statusText}</p>`; return; } const data = await r.json(); if(!data || !data.results || data.results.length===0){ resultsContainer.innerHTML='<p class="no-results">Không tìm thấy kết quả.</p>'; return; } let html=`<div class="results-info">Tìm thấy ${data.total||data.results.length} kết quả — Trang ${data.page||1}</div><div class="results-list">`; data.results.forEach(r2=>{ const it = r2.item||r2; html+=`<article class="result-card"><h3 class="result-title"><a href="${escapeHtml(it.url||'#')}" target="_blank">${escapeHtml(it.title||(it.name||'(Không tiêu đề)'))}</a></h3><div class="result-meta">${escapeHtml(it.subject||'')}</div><p class="result-snippet">${escapeHtml((it.content||'').slice(0,250))}...</p></article>`; }); html+='</div>'; resultsContainer.innerHTML = html; } catch(err){ resultsContainer.innerHTML=`<p class="error">Lỗi khi tìm kiếm: ${escapeHtml(err.message)}</p>`; } }

  if(searchForm) searchForm.addEventListener('submit', (e)=>{ e.preventDefault(); doSearch(inputEl? inputEl.value : new FormData(searchForm).get('q')); hideDropdown(); });

  // --- Inline login (if exists) ---
  const inlineLoginForm = $('#inlineLoginForm');
  if(inlineLoginForm){
    inlineLoginForm.addEventListener('submit', async function(e){
      e.preventDefault();
      const btn = inlineLoginForm.querySelector('button[type="submit"], input[type="submit"]');
      if(btn) btn.disabled = true;
      const fd = new FormData(inlineLoginForm);
      const payload = { username: fd.get('username'), password: fd.get('password') };
      function showInlineError(msg){ let el = inlineLoginForm.querySelector('.inline-login-error'); if(!el){ el=document.createElement('div'); el.className='inline-login-error err'; inlineLoginForm.prepend(el);} el.textContent = msg; }
      try {
        const res = await fetch('/api/login', { method:'POST', headers:{ 'Content-Type':'application/json','Accept':'application/json','X-Requested-With':'XMLHttpRequest' }, credentials:'include', body: JSON.stringify(payload) });
        if(res.redirected){ window.location.replace(res.url); return; }
        const ct = res.headers.get('content-type')||'';
        if(ct.indexOf('application/json')!==-1){
          const json = await res.json();
          if(res.ok && (json.ok || json.user || json.token)){
            try{ const remember = !!inlineLoginForm.querySelector('input[name="remember"]:checked'); if(json.token){ if(remember) localStorage.setItem('auth_token', json.token); else sessionStorage.setItem('auth_token', json.token); } }catch(e){}
            await loadUser();
            const wrap = $('#inlineLogin'); if(wrap){ wrap.classList.add('hidden'); wrap.setAttribute('aria-hidden','true'); }
            return;
          } else { showInlineError(json.message || 'Đăng nhập thất bại'); }
        } else if(ct.indexOf('text/html')!==-1){ window.location.reload(); return; }
        else { const txt = await res.text(); showInlineError('Phản hồi không hợp lệ từ server'); console.debug('login text', txt.slice(0,200)); }
      } catch(err){ showInlineError('Lỗi mạng, thử lại sau'); }
      finally { if(btn) btn.disabled = false; }
    });
  }

  // --- Auth helpers & UI ---
  function clearAuthStateClientSide(){ try{ ['auth_token','auth_user','token','user'].forEach(k=>{ try{ localStorage.removeItem(k);}catch{}; try{ sessionStorage.removeItem(k);}catch{} }); document.cookie.split(';').forEach(c=>{ const name=c.split('=')[0].trim(); if(!name) return; document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'; }); }catch(e){ console.warn(e);} }

  function parseUserFromMeResponse(obj){
    if(!obj) return null;
    if(obj.user) return obj.user;
    if(obj.username || obj.displayName || obj.email || obj.id) return obj;
    if(obj.data && obj.data.user) return obj.data.user;
    return null;
  }

  function updateAuthUI(user){
    const authLoginLink = $('#link-login');
    const authRegisterLink = $('#link-register');
    const headerLogoutBtn = $('#btn-logout-header');
    const userCardLogoutBtn = $('#btn-logout');
    if(user){
      if(userCard) userCard.classList.remove('hidden');
      if(userInfoEl) userInfoEl.textContent = user.displayName || user.username || (user.email||'');
      if(authLoginLink) authLoginLink.style.display = 'none';
      if(authRegisterLink) authRegisterLink.style.display = 'none';
      if(headerLogoutBtn) headerLogoutBtn.style.display = '';
      if(userCardLogoutBtn) userCardLogoutBtn.style.display = '';
    } else {
      if(userCard) userCard.classList.add('hidden');
      if(userInfoEl) userInfoEl.textContent = '';
      if(authLoginLink) authLoginLink.style.display = '';
      if(authRegisterLink) authRegisterLink.style.display = '';
      if(headerLogoutBtn) headerLogoutBtn.style.display = 'none';
      if(userCardLogoutBtn) userCardLogoutBtn.style.display = 'none';
    }
  }

  async function loadUser(){
    try {
      const r = await fetch('/api/me', { credentials:'include', cache:'no-store' });
      const ct = r.headers.get('content-type') || '';
      if(ct.indexOf('text/html') !== -1){ updateAuthUI(null); return null; }
      if(!r.ok){ updateAuthUI(null); return null; }
      const j = await r.json().catch(()=>null);
      const user = parseUserFromMeResponse(j);
      updateAuthUI(user);
      return user;
    } catch(e){ console.warn('loadUser error', e); updateAuthUI(null); return null; }
  }

  async function serverLogout(){
    try{ const r = await fetch('/logout.php',{ method:'POST', credentials:'include', headers:{ 'Accept':'application/json' } }); if(r.ok){ try{ await r.json(); }catch{}; return { ok:true, endpoint:'/logout.php' }; } }catch(e){}
    try{ const r2 = await fetch('/api/logout',{ method:'POST', credentials:'include', headers:{ 'Accept':'application/json' } }); if(r2.ok){ try{ await r2.json(); }catch{}; return { ok:true, endpoint:'/api/logout' }; } return { ok:false, endpoint:'/api/logout', status:r2.status }; }catch(e){ return { ok:false, error:e }; }
  }

  async function doLogout(){
    try {
      await serverLogout();
      clearAuthStateClientSide();
      updateAuthUI(null);
      try { const me = await fetch('/api/me',{ credentials:'include', cache:'no-store' }); if(me.ok){ const j = await me.json().catch(()=>null); if(parseUserFromMeResponse(j)){ location.reload(); return; } } } catch(e){}
      return;
    } catch(e){ console.error('doLogout error', e); clearAuthStateClientSide(); try{ location.reload(); }catch(err){ window.location.href='/'; } }
  }

  function installLogoutButtons(){ const btns = $$('button#btn-logout, #btn-logout-header, .btn-logout'); btns.forEach(b=>{ if(b._installed) return; b.addEventListener('click', function(ev){ ev.preventDefault(); doLogout(); }, { passive:false }); b._installed = true; }); }

  // --- Init ---
  function initAuthChecks(){ loadUser(); setTimeout(()=>loadUser(), 400); window.addEventListener('focus', ()=>loadUser()); }

  document.addEventListener('DOMContentLoaded', function(){
    populateSubjects();
    installSubjectDelegation();
    installLogoutButtons();
    initAuthChecks();

    const btnTest = document.getElementById('btn-test');
    if(btnTest){ btnTest.addEventListener('click', async ()=>{ try{ const r = await fetch('/api/secure-test', { credentials:'include' }); const t = await r.text(); const apiResult = document.getElementById('api-result'); if(apiResult) apiResult.textContent = `Status ${r.status}: ${t.slice(0,250)}`; }catch(e){ console.error(e);} }); }
  });

  // Expose for debugging
  window.FP = window.FP || {};
  window.FP.populateSubjects = populateSubjects;
  window.FP.showSubjectDetail = showSubjectDetail;
  window.loadUser = loadUser;
  window.doLogout = doLogout;
  window.clearAuthStateClientSide = clearAuthStateClientSide;
  window.FP.getResourcesFor = getResourcesFor;
})();
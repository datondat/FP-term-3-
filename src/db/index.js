// public/index.js - subjects + books links (full)
// - populate subjects by grade
// - render SGK / SBT links in detail panel when clicking a subject
// - exposes window.FP.populateSubjects() and window.FP.booksMap for debugging
(function(){
  'use strict';
  window.FP = window.FP || {};

  function log(){ try{ console.info('[FP]', ...arguments); }catch(e){} }
  function warn(){ try{ console.warn('[FP]', ...arguments); }catch(e){} }
  function esc(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // ---------- Subjects ----------
  const subjectsByGrade = {
    6:['Toán','Ngữ văn','Tiếng Anh','Khoa học tự nhiên','Lịch sử','Địa lí','Tin học','Công nghệ','GDCD'],
    7:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Công nghệ'],
    8:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','Tin học'],
    9:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Lịch sử','Địa lí','GDQPAN'],
    10:['Toán (Tự chọn/Chuyên)','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDCD'],
    11:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','GDQPAN'],
    12:['Toán','Ngữ văn','Tiếng Anh','Vật lí','Hóa học','Sinh học','Tin học','Lịch sử & Địa lí'],
    common:['Giáo dục công dân','Công nghệ','Khoa học tự nhiên','Giáo dục kinh tế và pháp luật']
  };

  // ---------- Books map: key = "<grade>|<subject>" -> [{label,url}, ...] ----------
  // Populated from the URLs you provided earlier
  const booksMap = {
    // NGỮ VĂN
    '6|Ngữ văn': [
      { label: 'SGK Ngữ văn 6 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-1/1/22/0/' },
      { label: 'SGK Ngữ văn 6 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-2/1/23/0/' },
      { label: 'SBT Ngữ văn 6 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-1/5/50/0/' },
      { label: 'SBT Ngữ văn 6 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-2/5/174/0/' }
    ],
    '7|Ngữ văn': [
      { label: 'SGK Ngữ văn 7 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-7-tap-1/1/139/0/' },
      { label: 'SGK Ngữ văn 7 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-7-tap-2/1/140/0/' },
      { label: 'SBT Ngữ văn 7 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-7-tap-1/5/282/0/' },
      { label: 'SBT Ngữ văn 7 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-7-tap-2/5/283/0/' }
    ],
    '8|Ngữ văn': [
      { label: 'SGK Ngữ văn 8 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-8-tap-1/1/412/0/' },
      { label: 'SGK Ngữ văn 8 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-8-tap-2/1/414/0/' },
      { label: 'SBT Ngữ văn 8 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-8-tap-1/5/422/0/' },
      { label: 'SBT Ngữ văn 8 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-8-tap-2/5/423/0/' }
    ],
    '9|Ngữ văn': [
      { label: 'SGK Ngữ văn 9 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-9-tap-1/1/697/0/' },
      { label: 'SGK Ngữ văn 9 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-9-tap-2/1/698/0/' },
      { label: 'SBT Ngữ văn 9 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-9-tap-1/5/713/0/' },
      { label: 'SBT Ngữ văn 9 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-9-tap-2/5/714/0/' }
    ],
    '10|Ngữ văn': [
      { label: 'SGK Ngữ văn 10 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-10-tap-1/1/153/0/' },
      { label: 'SGK Ngữ văn 10 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-10-tap-2/1/154/0/' },
      { label: 'Chuyên đề Ngữ văn 10', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-ngu-van-10/1/199/0/' },
      { label: 'SBT Ngữ văn 10 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-10-tap-1/5/288/0/' },
      { label: 'SBT Ngữ văn 10 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-10-tap-2/5/289/0/' }
    ],
    '11|Ngữ văn': [
      { label: 'SGK Ngữ văn 11 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-11-tap-1/1/444/0/' },
      { label: 'SGK Ngữ văn 11 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-11-tap-2/1/445/0/' },
      { label: 'Chuyên đề Ngữ văn 11', url: 'https://www.hoc10.vn/doc-sach/cd-ngu-van-11/1/395/0/' },
      { label: 'SBT Ngữ văn 11 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-11-tap-1/5/430/0/' },
      { label: 'SBT Ngữ văn 11 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-11-tap-2/5/432/0/' }
    ],
    '12|Ngữ văn': [
      { label: 'SGK Ngữ văn 12 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-12-tap-1/1/719/0/' },
      { label: 'SGK Ngữ văn 12 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-12-tap-2/1/720/0/' },
      { label: 'Chuyên đề Ngữ văn 12', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-ngu-van-12/1/740/0/' },
      { label: 'SBT Ngữ văn 12 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-12-tap-1/5/752/0/' },
      { label: 'SBT Ngữ văn 12 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-12-tap-2/5/753/0/' }
    ],

    // TOÁN
    '6|Toán': [
      { label: 'SGK Toán 6 - T1', url: 'https://www.hoc10.vn/doc-sach/toan-6-1/1/24/0/' },
      { label: 'SGK Toán 6 - T2', url: 'https://www.hoc10.vn/doc-sach/toan-6-2/1/35/0/' },
      { label: 'SBT Toán 6 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-6-tap-1/5/52/0/' },
      { label: 'SBT Toán 6 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-6-tap-2/5/178/0/' }
    ],
    '7|Toán': [
      { label: 'SGK Toán 7 - T1', url: 'https://www.hoc10.vn/doc-sach/toan-7-tap-1/1/141/0/' },
      { label: 'SGK Toán 7 - T2', url: 'https://www.hoc10.vn/doc-sach/toan-7-tap-2/1/142/0/' },
      { label: 'SBT Toán 7 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-7-tap-1/5/284/0/' },
      { label: 'SBT Toán 7 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-7-tap-2/5/285/0/' }
    ],
    '8|Toán': [
      { label: 'SGK Toán 8 - T1', url: 'https://www.hoc10.vn/doc-sach/toan-8-tap-1/1/417/0/' },
      { label: 'SGK Toán 8 - T2', url: 'https://www.hoc10.vn/doc-sach/toan-8-tap-2/1/419/0/' },
      { label: 'SBT Toán 8 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-8-tap-1/5/425/0/' },
      { label: 'SBT Toán 8 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-8-tap-2/5/427/0/' }
    ],
    '9|Toán': [
      { label: 'SGK Toán 9 - T1', url: 'https://www.hoc10.vn/doc-sach/toan-9-tap-1/1/699/0/' },
      { label: 'SGK Toán 9 - T2', url: 'https://www.hoc10.vn/doc-sach/toan-9-tap-2/1/700/0/' },
      { label: 'SBT Toán 9 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-9-tap-1/5/715/0/' },
      { label: 'SBT Toán 9 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-9-tap-2/5/716/0/' }
    ],
    '10|Toán (Tự chọn/Chuyên)': [
      { label: 'SGK Toán 10 - T1', url: 'https://www.hoc10.vn/doc-sach/toan-10-tap-1/1/155/0/' },
      { label: 'SGK Toán 10 - T2', url: 'https://www.hoc10.vn/doc-sach/toan-10-tap-2/1/156/0/' },
      { label: 'Chuyên đề Toán 10', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-toan-10/1/200/0/' },
      { label: 'SBT Toán 10 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-10-tap-1/5/286/0/' },
      { label: 'SBT Toán 10 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-10-tap-2/5/287/0/' }
    ],
    '11|Toán': [
      { label: 'SGK Toán 11 - T1', url: 'https://www.hoc10.vn/doc-sach/toan-11-tap-1/1/446/0/' },
      { label: 'SGK Toán 11 - T2', url: 'https://www.hoc10.vn/doc-sach/toan-11-tap-2/1/447/0/' },
      { label: 'Chuyên đề Toán 11', url: 'https://www.hoc10.vn/doc-sach/cd-toan-11/1/396/0/' },
      { label: 'SBT Toán 11 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-11-tap-1/5/433/0/' },
      { label: 'SBT Toán 11 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-11-tap-2/5/435/0/' }
    ],
    '12|Toán': [
      { label: 'SGK Toán 12 - T1', url: 'https://www.hoc10.vn/doc-sach/toan-12-tap-1/1/721/0/' },
      { label: 'SGK Toán 12 - T2', url: 'https://www.hoc10.vn/doc-sach/toan-12-tap-2/1/722/0/' },
      { label: 'Chuyên đề Toán 12', url: 'https://www.hoc10.vn/doc-sach/chuyen-de-hoc-tap-toan-12/1/741/0/' },
      { label: 'SBT Toán 12 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-12-tap-1/5/754/0/' },
      { label: 'SBT Toán 12 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-12-tap-2/5/755/0/' }
    ],

    // TIẾNG ANH
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

    // TIN HỌC (ví dụ)
    '6|Tin học': [
      { label: 'SGK Tin học 6', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-6/1/28/0/' }
    ],
    '7|Tin học': [
      { label: 'SGK Tin học 7', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-7/1/147/0/' }
    ],
    '8|Tin học': [
      { label: 'SGK Tin học 8', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-8/1/421/0/' }
    ],
    '9|Tin học': [
      { label: 'SGK Tin học 9', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-9/1/701/0/' }
    ],
    '10|Tin học': [
      { label: 'SGK Tin học 10', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-10/1/164/0/' }
    ]
  };

  // ---------- DOM creation ----------
  function createSubjectItem(name, grade){
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = name;
    a.href = '#';
    a.className = 'subject';
    a.setAttribute('data-subject', name);
    a.setAttribute('data-grade', grade);
    a.setAttribute('data-desc', `Mô tả mẫu cho môn "${name}".`);
    a.addEventListener('click', function(e){
      e.preventDefault();
      showSubjectDetail(name, grade);
    });
    li.appendChild(a);
    return li;
  }

  function populateSubjects(){
    try{
      log('populateSubjects');
      Object.keys(subjectsByGrade).forEach(function(g){
        const el = document.getElementById('grade-' + g);
        if(!el){
          log('missing element', 'grade-' + g);
          return;
        }
        el.innerHTML = '';
        (subjectsByGrade[g]||[]).forEach(function(sub){
          el.appendChild(createSubjectItem(sub, g));
        });
        log('populated', 'grade-' + g, 'count=', el.children.length);
      });
    }catch(err){
      console.error('[FP] populateSubjects error', err);
    }
  }

  // ---------- render book links in detail panel ----------
  function renderBookLinks(grade, subject){
    const key = grade + '|' + subject;
    const list = booksMap[key] || [];
    const wrap = document.createElement('div');
    wrap.className = 'subject-books';
    if(list.length === 0){
      const span = document.createElement('div');
      span.className = 'muted';
      span.textContent = 'Không có tài liệu tham khảo cho môn này.';
      wrap.appendChild(span);
      return wrap;
    }
    list.forEach(function(b, idx){
      const a = document.createElement('a');
      a.href = b.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'book-link';
      a.textContent = b.label;
      wrap.appendChild(a);
      if(idx < list.length - 1){
        const sep = document.createElement('span');
        sep.style.marginRight = '6px';
        wrap.appendChild(sep);
      }
    });
    return wrap;
  }

  function showSubjectDetail(name, grade){
    const title = document.getElementById('subject-title');
    const desc = document.getElementById('subject-desc');
    const booksEl = document.getElementById('subject-books');
    const wrap = document.getElementById('subject-detail');
    if(title) title.textContent = name;
    if(desc) desc.textContent = `Mô tả mẫu cho môn "${name}".`;
    if(booksEl){
      booksEl.innerHTML = '';
      booksEl.appendChild(renderBookLinks(grade, name));
    }
    if(wrap) wrap.style.display = 'block';
    // scroll into view
    if(wrap) window.scrollTo({ top: wrap.offsetTop - 20, behavior: 'smooth' });
  }

  // ---------- init ----------
  function init(){
    populateSubjects();
    log('index.js init done');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ---------- exports ----------
  window.FP.populateSubjects = populateSubjects;
  window.FP.booksMap = booksMap;
  window.FP.showSubjectDetail = showSubjectDetail;

})();
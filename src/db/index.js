// public/index.js
// Phiên bản đầy đủ: chèn mọi môn theo từng lớp và các link SGK/SBT (hoc10).
// - Khi bấm vào môn sẽ hiển thị danh sách nút/links trong khung chi tiết.
// - Nếu có link cụ thể mình dùng URL hoc10 có sẵn; nếu không có, link sẽ dẫn tới trang tìm kiếm hoc10 cho môn + lớp.
// - Sao lưu file cũ trước khi ghi đè.
(function(){
  'use strict';
  window.FP = window.FP || {};

  const log = (...args) => { try{ console.info('[FP]', ...args); }catch(e){} };
  const esc = s => s ? String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]) : '';

  // --------- Danh sách môn theo lớp ----------
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

  // Helper tạo link tìm kiếm trên hoc10 cho môn + lớp khi không có link cụ thể
  function hoc10Search(subject, grade){
    const q = encodeURIComponent(subject + ' ' + (grade || ''));
    return `https://www.hoc10.vn/tim-kiem?q=${q}`;
  }

  // --------- Bản đồ sách (grade|subject => [{label,url}]) ----------
  // Mình lấp đầy càng nhiều link cụ thể càng tốt; nếu không có link cụ thể sẽ có 1 link search hoc10.
  const booksMap = {
    /* NGỮ VĂN */
    '6|Ngữ văn': [
      { label: 'SGK Ngữ văn 6 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-1/1/22/0/' },
      { label: 'SGK Ngữ văn 6 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-6-2/1/23/0/' },
      { label: 'SBT Ngữ văn 6 - Tập 1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-1/5/50/0/' },
      { label: 'SBT Ngữ văn 6 - Tập 2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-6-tap-2/5/174/0/' }
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
      { label: 'SBT Ngữ văn 10 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-10-tap-1/5/288/0/' },
      { label: 'SBT Ngữ văn 10 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-10-tap-2/5/289/0/' }
    ],
    '11|Ngữ văn': [
      { label: 'SGK Ngữ văn 11 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-11-tap-1/1/444/0/' },
      { label: 'SGK Ngữ văn 11 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-11-tap-2/1/445/0/' },
      { label: 'SBT Ngữ văn 11 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-11-tap-1/5/430/0/' },
      { label: 'SBT Ngữ văn 11 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-11-tap-2/5/432/0/' }
    ],
    '12|Ngữ văn': [
      { label: 'SGK Ngữ văn 12 - T1', url: 'https://www.hoc10.vn/doc-sach/ngu-van-12-tap-1/1/719/0/' },
      { label: 'SGK Ngữ văn 12 - T2', url: 'https://www.hoc10.vn/doc-sach/ngu-van-12-tap-2/1/720/0/' },
      { label: 'SBT Ngữ văn 12 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-12-tap-1/5/752/0/' },
      { label: 'SBT Ngữ văn 12 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-ngu-van-12-tap-2/5/753/0/' }
    ],

    /* TOÁN */
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
      { label: 'SBT Toán 10 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-10-tap-1/5/286/0/' },
      { label: 'SBT Toán 10 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-10-tap-2/5/287/0/' }
    ],
    '11|Toán': [
      { label: 'SGK Toán 11 - T1', url: 'https://www.hoc10.vn/doc-sach/toan-11-tap-1/1/446/0/' },
      { label: 'SGK Toán 11 - T2', url: 'https://www.hoc10.vn/doc-sach/toan-11-tap-2/1/447/0/' },
      { label: 'SBT Toán 11 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-11-tap-1/5/433/0/' },
      { label: 'SBT Toán 11 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-11-tap-2/5/435/0/' }
    ],
    '12|Toán': [
      { label: 'SGK Toán 12 - T1', url: 'https://www.hoc10.vn/doc-sach/toan-12-tap-1/1/721/0/' },
      { label: 'SGK Toán 12 - T2', url: 'https://www.hoc10.vn/doc-sach/toan-12-tap-2/1/722/0/' },
      { label: 'SBT Toán 12 - T1', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-12-tap-1/5/754/0/' },
      { label: 'SBT Toán 12 - T2', url: 'https://www.hoc10.vn/doc-sach/sbt-toan-12-tap-2/5/755/0/' }
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
    ],
    '11|Tin học': [
      { label: 'SGK Tin học 11 - Khoa học máy tính', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-11-khoa-hoc-may-tinh/1/387/0/' }
    ],
    '12|Tin học': [
      { label: 'SGK Tin học 12 - Ứng dụng', url: 'https://www.hoc10.vn/doc-sach/tin-hoc-12-tin-hoc-ung-dung/1/737/0/' }
    ],

    /* VẬT LÍ (fallback to search if specific not provided) */
    '6|Vật lí': [ { label: 'Tìm Vật lí 6 trên hoc10', url: hoc10Search('Vật lí','6') } ],
    '7|Vật lí': [ { label: 'Tìm Vật lí 7 trên hoc10', url: hoc10Search('Vật lí','7') } ],
    '8|Vật lí': [ { label: 'Tìm Vật lí 8 trên hoc10', url: hoc10Search('Vật lí','8') } ],
    '9|Vật lí': [ { label: 'Tìm Vật lí 9 trên hoc10', url: hoc10Search('Vật lí','9') } ],
    '10|Vật lí': [ { label: 'Tìm Vật lí 10 trên hoc10', url: hoc10Search('Vật lí','10') } ],
    '11|Vật lí': [ { label: 'Tìm Vật lí 11 trên hoc10', url: hoc10Search('Vật lí','11') } ],
    '12|Vật lí': [ { label: 'Tìm Vật lí 12 trên hoc10', url: hoc10Search('Vật lí','12') } ],

    /* HÓA HỌC */
    '6|Hóa học': [ { label: 'Tìm Hóa học 6 trên hoc10', url: hoc10Search('Hóa học','6') } ],
    '7|Hóa học': [ { label: 'Tìm Hóa học 7 trên hoc10', url: hoc10Search('Hóa học','7') } ],
    '8|Hóa học': [ { label: 'Tìm Hóa học 8 trên hoc10', url: hoc10Search('Hóa học','8') } ],
    '9|Hóa học': [ { label: 'Tìm Hóa học 9 trên hoc10', url: hoc10Search('Hóa học','9') } ],
    '10|Hóa học': [ { label: 'Tìm Hóa học 10 trên hoc10', url: hoc10Search('Hóa học','10') } ],
    '11|Hóa học': [ { label: 'Tìm Hóa học 11 trên hoc10', url: hoc10Search('Hóa học','11') } ],
    '12|Hóa học': [ { label: 'Tìm Hóa học 12 trên hoc10', url: hoc10Search('Hóa học','12') } ],

    /* SINH HỌC */
    '6|Sinh học': [ { label: 'Tìm Sinh học 6 trên hoc10', url: hoc10Search('Sinh học','6') } ],
    '7|Sinh học': [ { label: 'Tìm Sinh học 7 trên hoc10', url: hoc10Search('Sinh học','7') } ],
    '8|Sinh học': [ { label: 'Tìm Sinh học 8 trên hoc10', url: hoc10Search('Sinh học','8') } ],
    '9|Sinh học': [ { label: 'Tìm Sinh học 9 trên hoc10', url: hoc10Search('Sinh học','9') } ],
    '10|Sinh học': [ { label: 'Tìm Sinh học 10 trên hoc10', url: hoc10Search('Sinh học','10') } ],
    '11|Sinh học': [ { label: 'Tìm Sinh học 11 trên hoc10', url: hoc10Search('Sinh học','11') } ],
    '12|Sinh học': [ { label: 'Tìm Sinh học 12 trên hoc10', url: hoc10Search('Sinh học','12') } ],

    /* LỊCH SỬ / ĐỊA LÍ */
    '6|Lịch sử': [ { label: 'Tìm Lịch sử 6', url: hoc10Search('Lịch sử','6') } ],
    '7|Lịch sử': [ { label: 'Tìm Lịch sử 7', url: hoc10Search('Lịch sử','7') } ],
    '8|Lịch sử': [ { label: 'Tìm Lịch sử 8', url: hoc10Search('Lịch sử','8') } ],
    '9|Lịch sử': [ { label: 'Tìm Lịch sử 9', url: hoc10Search('Lịch sử','9') } ],
    '10|Lịch sử & Địa lí': [ { label: 'Tìm Lịch sử 10', url: hoc10Search('Lịch sử','10') } ],
    '11|Lịch sử & Địa lí': [ { label: 'Tìm Lịch sử 11', url: hoc10Search('Lịch sử','11') } ],
    '12|Lịch sử & Địa lí': [ { label: 'Tìm Lịch sử 12', url: hoc10Search('Lịch sử','12') } ],
    '6|Địa lí': [ { label: 'Tìm Địa lí 6', url: hoc10Search('Địa lí','6') } ],
    '7|Địa lí': [ { label: 'Tìm Địa lí 7', url: hoc10Search('Địa lí','7') } ],
    '8|Địa lí': [ { label: 'Tìm Địa lí 8', url: hoc10Search('Địa lí','8') } ],
    '9|Địa lí': [ { label: 'Tìm Địa lí 9', url: hoc10Search('Địa lí','9') } ],
    '10|Địa lí': [ { label: 'Tìm Địa lí 10', url: hoc10Search('Địa lí','10') } ],
    '11|Địa lí': [ { label: 'Tìm Địa lí 11', url: hoc10Search('Địa lí','11') } ],
    '12|Địa lí': [ { label: 'Tìm Địa lí 12', url: hoc10Search('Địa lí','12') } ],

    /* GDCD, GDQPAN, CÔNG NGHỆ, CHUNG */
    '6|GDCD': [ { label: 'Tìm GDCD 6', url: hoc10Search('GDCD','6') } ],
    '10|GDCD': [ { label: 'Tìm GDCD 10', url: hoc10Search('GDCD','10') } ],
    '9|GDQPAN': [ { label: 'Tìm GDQPAN 9', url: hoc10Search('GDQPAN','9') } ],
    '11|GDQPAN': [ { label: 'Tìm GDQPAN 11', url: hoc10Search('GDQPAN','11') } ],
    '6|Công nghệ': [ { label: 'Tìm Công nghệ 6', url: hoc10Search('Công nghệ','6') } ],
    '7|Công nghệ': [ { label: 'Tìm Công nghệ 7', url: hoc10Search('Công nghệ','7') } ],
    '8|Công nghệ': [ { label: 'Tìm Công nghệ 8', url: hoc10Search('Công nghệ','8') } ],
    'common|Giáo dục công dân': [ { label: 'Tìm GDCD chung', url: hoc10Search('Giáo dục công dân','') } ],
    'common|Công nghệ': [ { label: 'Tìm Công nghệ chung', url: hoc10Search('Công nghệ','') } ]
  };

  // --------- DOM creation ----------
  function createSubjectItem(name, grade){
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = name;
    a.href = '#';
    a.className = 'subject';
    a.setAttribute('data-subject', name);
    a.setAttribute('data-grade', grade);
    a.setAttribute('data-desc', `Mô tả mẫu cho môn "${name}".`);
    li.appendChild(a);
    return li;
  }

  function populateSubjects(){
    try{
      log('populateSubjects start');
      Object.keys(subjectsByGrade).forEach(function(g){
        const el = document.getElementById('grade-' + g);
        if(!el) return;
        el.innerHTML = '';
        (subjectsByGrade[g]||[]).forEach(function(sub){
          el.appendChild(createSubjectItem(sub, g));
        });
      });
      log('populateSubjects done');
    }catch(err){
      console.error('[FP] populateSubjects error', err);
    }
  }

  // render links/buttons
  function renderBookLinks(grade, subject){
    const key = String(grade) + '|' + subject;
    const list = booksMap[key] || [];
    const wrap = document.createElement('div');
    wrap.className = 'subject-books';
    if(list.length === 0){
      // fallback: show a search link
      const a = document.createElement('a');
      a.className = 'book-link';
      a.href = hoc10Search(subject, grade);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = `Tìm SGK / SBT cho ${subject} (Lớp ${grade}) trên hoc10`;
      wrap.appendChild(a);
      return wrap;
    }
    list.forEach(function(b){
      const a = document.createElement('a');
      a.href = b.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'book-link';
      a.textContent = b.label;
      wrap.appendChild(a);
    });
    return wrap;
  }

  function showSubjectDetail(name, grade){
    const title = document.getElementById('subject-title');
    const desc = document.getElementById('subject-desc');
    const booksEl = document.getElementById('subject-books');
    const wrap = document.getElementById('subject-detail');
    if(title) title.textContent = name;
    if(desc) desc.textContent = `Tài liệu cho ${name} — Lớp ${grade}. Nhấn vào nút để mở trang sách.`;
    if(booksEl){
      booksEl.innerHTML = '';
      booksEl.appendChild(renderBookLinks(grade, name));
    }
    if(wrap) wrap.style.display = 'block';
    if(wrap) window.scrollTo({ top: wrap.offsetTop - 20, behavior: 'smooth' });
  }

  // delegation handler
  function installDelegation(){
    const container = document.querySelector('.subjects-view') || document.body;
    container.addEventListener('click', function(e){
      let el = e.target;
      while(el && el !== container){
        if(el.matches && el.matches('a.subject')){
          e.preventDefault();
          const subject = el.dataset.subject || el.textContent.trim();
          const grade = el.dataset.grade || el.closest('[id^="grade-"]')?.id?.replace('grade-','') || 'unknown';
          showSubjectDetail(subject, grade);
          return;
        }
        el = el.parentNode;
      }
    }, false);
  }

  // ensure login/register links navigate (in case other scripts prevent)
  function ensureAuthNavigation(){
    ['link-login','link-register'].forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('click', function(ev){
        const href = el.getAttribute('href') || el.dataset.href;
        if(href){
          window.location.assign(href);
          ev.stopImmediatePropagation();
        }
      }, { capture: true });
    });
  }

  // --------- Init ----------
  function init(){
    populateSubjects();
    installDelegation();
    ensureAuthNavigation();
    log('public/index.js initialized');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exports
  window.FP.populateSubjects = populateSubjects;
  window.FP.showSubjectDetail = showSubjectDetail;
  window.FP.booksMap = booksMap;

})();
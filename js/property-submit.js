/* ============================================================
   매물 접수 → 이메일 전송

   ── 설정 (여기 두 줄만 채우면 됩니다) ──────────────────────

   1) FORM_ENDPOINT : 접수 내용을 이메일로 보내주는 주소
      · formspree.io 가입 (무료, 월 50건)
      · New Form 만들고 받을 이메일 지정
      · 나오는 https://formspree.io/f/xxxxxxxx 주소를 아래에 붙여넣기

   2) NOTIFY_EMAIL : 접수받을 이메일 주소
      · 1번을 아직 안 하셨어도, 이것만 넣으면 방문자의 메일 앱이 열려
        내용이 채워진 상태로 보낼 수 있습니다 (임시 방편)

   둘 다 비어 있으면 접수 버튼을 눌러도 아무 데도 전달되지 않습니다.
   ============================================================ */

var FORM_ENDPOINT = 'https://formspree.io/f/xaeynzkr';   // 접수 내용이 gywjd4833@naver.com 으로 갑니다
var NOTIFY_EMAIL  = '';   // 예비용 (FORM_ENDPOINT 가 있으면 쓰이지 않습니다)

(function () {
  'use strict';

  var form = document.getElementById('property-form');
  if (!form) return;

  /* 화면에 보이는 이름으로 바꿔서 메일에 담습니다 */
  var LABELS = {
    userName:     '이름',
    userPhone:    '연락처',
    propertyType: '매물 종류',
    oneName:      '건물명 및 상세 주소',
    oneTransType: '거래 종류',
    onePrice:     '희망 가격',
    oneFeatures:  '매물 특징',
    blogConsent:  '블로그 마케팅 동의'
  };

  var VALUES = {
    apt_complex: '아파트/주상복합',
    sale_right:  '분양권/입주권',
    living_acc:  '생활형숙박시설',
    one_office:  '오피스텔/원투룸',
    villa:       '단독/다가구/빌라',
    office_com:  '상가/사무실',
    land:        '토지',
    sale:        '매매',
    jeonse:      '전세',
    monthly:     '월세',
    agree:       '동의',
    disagree:    '동의하지 않음'
  };

  /* 결과 메시지를 보여줄 자리 */
  var notice = document.createElement('p');
  notice.style.cssText = 'margin:14px 0 0;font-size:14px;line-height:1.6;text-align:center;display:none;';
  form.appendChild(notice);

  function say(text, kind) {
    notice.textContent = text;
    notice.style.color = kind === 'error' ? '#e42939' : (kind === 'ok' ? '#0059b9' : '#4e5968');
    notice.style.display = 'block';
  }

  function collect() {
    var data = new FormData(form);
    var out = {};

    Object.keys(LABELS).forEach(function (key) {
      var all = data.getAll(key).filter(function (v) { return v !== ''; });
      if (!all.length) return;
      var text = all.map(function (v) { return VALUES[v] || v; }).join(', ');
      out[LABELS[key]] = text;
    });

    return out;
  }

  function asText(obj) {
    return Object.keys(obj).map(function (k) {
      return k + ': ' + obj[k];
    }).join('\n');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name  = (form.querySelector('#userName')  || {}).value || '';
    var phone = (form.querySelector('#userPhone') || {}).value || '';
    var agreed = (form.querySelector('#privacyConsent') || {}).checked;

    if (!name.trim())  { say('이름을 입력해 주세요.', 'error'); form.querySelector('#userName').focus(); return; }
    if (!phone.trim()) { say('연락처를 입력해 주세요.', 'error'); form.querySelector('#userPhone').focus(); return; }
    if (!agreed)       { say('개인정보 수집 및 이용에 동의해 주세요.', 'error'); return; }

    var data = collect();
    data['접수 일시'] = new Date().toLocaleString('ko-KR');

    var btn = form.querySelector('button[type="submit"]');
    var label = btn ? btn.textContent : '';

    /* 1) 정식 방법 - 이메일 전송 서비스로 보냄 */
    if (FORM_ENDPOINT) {
      if (btn) { btn.disabled = true; btn.textContent = '접수 중입니다...'; }
      say('접수 중입니다. 잠시만 기다려 주세요.');

      /* _subject 는 메일 제목이 됩니다 (예: [매물접수] 홍길동 (010-1234-5678)) */
      var payload = { _subject: '[매물접수] ' + name.trim() + ' (' + phone.trim() + ')' };
      Object.keys(data).forEach(function (k) { payload[k] = data[k]; });

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error(res.status);
        form.reset();
        say('매물 접수가 완료되었습니다. 확인 후 빠르게 연락드리겠습니다.', 'ok');
      }).catch(function () {
        say('접수 중 문제가 발생했습니다. 010-9254-7988 로 전화 주시면 바로 도와드리겠습니다.', 'error');
      }).then(function () {
        if (btn) { btn.disabled = false; btn.textContent = label; }
      });
      return;
    }

    /* 2) 임시 방법 - 방문자의 메일 앱을 열어 내용을 채워 줌 */
    if (NOTIFY_EMAIL) {
      var subject = '[매물 접수] ' + name + ' (' + phone + ')';
      window.location.href = 'mailto:' + NOTIFY_EMAIL +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(asText(data));
      say('메일 앱이 열립니다. 그대로 보내주시면 접수됩니다.', 'ok');
      return;
    }

    /* 3) 설정 전 - 전화 안내 */
    say('현재 온라인 접수가 준비 중입니다. 010-9254-7988 로 전화 주시면 바로 상담해 드립니다.', 'error');
    console.warn('[매물접수] js/property-submit.js 의 FORM_ENDPOINT 또는 NOTIFY_EMAIL 을 설정해 주세요.');
    console.log('입력된 내용:\n' + asText(data));
  });
})();

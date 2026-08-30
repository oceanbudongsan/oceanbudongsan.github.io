/* ============================================================
   관리자 페이지 잠금 (아이디 / 비밀번호)

   ── 아이디·비밀번호 바꾸는 법 ──────────────────────────────
   1. 관리자 페이지를 브라우저에서 엽니다
   2. F12 를 눌러 개발자 도구 → Console 탭으로 갑니다
   3. 아래처럼 입력하고 엔터를 칩니다
        ocMakeHash('새로운비밀번호')
   4. 화면에 나온 긴 글자를 복사해서, 아래 PASS_HASH 의 따옴표 안에 붙여넣습니다
   5. 아이디는 USER_ID 의 따옴표 안을 고치면 됩니다

   ⚠️ 이 잠금은 "일반 방문자가 실수로 들어오는 것"을 막는 수준입니다.
      브라우저에서 소스를 볼 줄 아는 사람은 우회할 수 있습니다.
      실제로 홈페이지를 운영하실 때는 호스팅 업체의 비밀번호 기능이나
      서버 로그인을 함께 쓰시는 것을 권합니다.
   ============================================================ */

(function () {
  'use strict';

  var USER_ID   = 'admin';
  var PASS_HASH = 'b6ec292847f07d73c2ef22c0c6b9f269e7d74bbf0b20b921dfef62f9144ce921'; // 기본 비밀번호: ocean1234
  var KEY       = 'oc-admin-auth';

  /* 비밀번호 해시 만들기 (콘솔에서 사용) */
  window.ocMakeHash = function (pw) {
    return sha256(pw).then(function (h) {
      console.log('%c' + h, 'font-size:14px;font-weight:bold;color:#0059b9');
      console.log('↑ 이 글자를 js/admin-auth.js 의 PASS_HASH 에 붙여넣으세요');
      return h;
    });
  };

  function sha256(text) {
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.reject(new Error('이 브라우저에서는 사용할 수 없습니다'));
    }
    var buf = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', buf).then(function (out) {
      return Array.prototype.map
        .call(new Uint8Array(out), function (b) { return ('0' + b.toString(16)).slice(-2); })
        .join('');
    });
  }

  /* 이미 로그인했으면 그냥 통과 (브라우저를 닫으면 풀립니다) */
  try {
    if (sessionStorage.getItem(KEY) === 'ok') return;
  } catch (e) { /* 저장소를 못 쓰는 환경이면 로그인 화면을 띄웁니다 */ }

  /* 로그인 전까지 페이지 내용을 가림 */
  var hide = document.createElement('style');
  hide.textContent =
    'body > *:not(#oc-gate){display:none!important;}' +
    'body{padding:0!important;background:#f2f4f6!important;}' +
    '#oc-gate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;' +
    'justify-content:center;padding:20px;background:#f2f4f6;' +
    'font-family:"Plus Jakarta Sans",-apple-system,"Malgun Gothic",sans-serif;}' +
    '#oc-gate .box{background:#fff;border-radius:16px;padding:32px 28px;width:100%;max-width:360px;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.10);box-sizing:border-box;}' +
    '#oc-gate h1{margin:0 0 4px;font-size:20px;font-weight:800;color:#0059b9;}' +
    '#oc-gate p.sub{margin:0 0 22px;font-size:13px;color:#6b7684;}' +
    '#oc-gate label{display:block;font-size:12px;font-weight:700;color:#4e5968;margin:0 0 6px;}' +
    '#oc-gate input{width:100%;height:46px;padding:0 14px;margin:0 0 14px;box-sizing:border-box;' +
    'border:1px solid #d1d6db;border-radius:10px;font-size:15px;outline:none;background:#fff;color:#191f28;}' +
    '#oc-gate input:focus{border-color:#0059b9;box-shadow:0 0 0 3px rgba(0,89,185,.12);}' +
    '#oc-gate button{width:100%;height:48px;border:0;border-radius:10px;background:#0059b9;' +
    'color:#fff;font-size:15px;font-weight:700;cursor:pointer;}' +
    '#oc-gate button:hover{background:#004a9c;}' +
    '#oc-gate .err{min-height:18px;margin:12px 0 0;font-size:13px;color:#e42939;text-align:center;}' +
    '#oc-gate .back{display:block;margin:18px 0 0;text-align:center;font-size:13px;' +
    'color:#6b7684;text-decoration:none;}' +
    '#oc-gate .back:hover{color:#0059b9;}';
  document.documentElement.appendChild(hide);

  function build() {
    var gate = document.createElement('div');
    gate.id = 'oc-gate';
    gate.innerHTML =
      '<form class="box" id="oc-gate-form" autocomplete="off">' +
        '<h1>관리자 로그인</h1>' +
        '<p class="sub">오션부동산 관리자만 들어올 수 있습니다.</p>' +
        '<label for="oc-gate-id">아이디</label>' +
        '<input id="oc-gate-id" type="text" autocomplete="username" autofocus>' +
        '<label for="oc-gate-pw">비밀번호</label>' +
        '<input id="oc-gate-pw" type="password" autocomplete="current-password">' +
        '<button type="submit">로그인</button>' +
        '<p class="err" id="oc-gate-err"></p>' +
        '<a class="back" href="index.html">← 홈으로 돌아가기</a>' +
      '</form>';
    document.body.appendChild(gate);

    var err = document.getElementById('oc-gate-err');

    document.getElementById('oc-gate-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var id = document.getElementById('oc-gate-id').value.trim();
      var pw = document.getElementById('oc-gate-pw').value;

      sha256(pw).then(function (h) {
        if (id === USER_ID && h === PASS_HASH) {
          try { sessionStorage.setItem(KEY, 'ok'); } catch (e2) {}
          location.reload();
        } else {
          err.textContent = '아이디 또는 비밀번호가 맞지 않습니다.';
          document.getElementById('oc-gate-pw').value = '';
          document.getElementById('oc-gate-pw').focus();
        }
      }).catch(function () {
        err.textContent = '이 브라우저에서는 로그인할 수 없습니다.';
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();

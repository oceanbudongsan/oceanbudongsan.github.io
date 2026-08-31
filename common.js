/* ============================================================
   오션부동산 공통 헤더 / 모바일 메뉴 / 푸터 / 하단바
   이 파일 하나만 고치면 전체 페이지에 반영됩니다.

   각 HTML 파일에는 아래 두 줄만 있으면 됩니다.
     <link rel="stylesheet" href="common.css">   (</head> 앞)
     <script src="common.js"></script>           (</body> 앞)

   페이지별로 다르게 하고 싶을 때 (선택):
     · 헤더 오른쪽 버튼 바꾸기
         <template id="oc-actions"> ...버튼 HTML... </template>
     · 모바일 드롭다운 메뉴에 항목 추가
         <template id="oc-menu-extra"> ...<a> 태그들... </template>
     · 모바일 하단바 숨기기 (관리자 페이지 등)
         <script src="common.js" data-bottomnav="off"></script>
   ============================================================ */

(function () {
  'use strict';

  /* ----- 여기만 고치면 전체 페이지가 함께 바뀝니다 ----- */
  var INFO = {
    brand: '오션부동산',        // 헤더 로고
    company: '강릉 오션 부동산', // 푸터 상호
    ceo: '전효정',              // 대표
    tel: '010-9254-7988',       // 상담용 (파란 박스 · 전화/문자 버튼 · 모바일 하단바)
    telOffice: '033-652-7988',  // 사무실 대표전화 (푸터 정보줄)
    reg: '51150-2025-00021',
    addr: '강원도 강릉시 경강로 2334 1층',
    copyright: '© 2026 강릉 오션 부동산. All rights reserved.'
  };

  var MENU = [
    { href: 'listings.html',        label: '매물찾기',   icon: 'search' },
    { href: 'property-submit.html', label: '매물접수',   icon: 'add_box' },
    { href: 'news.html',            label: '부동산소식', icon: 'newspaper' },
    { href: 'contact.html',         label: '오시는 길',  icon: 'location_on' }
  ];
  /* --------------------------------------------------- */

  var script = document.currentScript;
  var showBottomNav = !(script && script.getAttribute('data-bottomnav') === 'off');

  function tpl(id) {
    var t = document.getElementById(id);
    return t ? t.innerHTML : '';
  }

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  /* ---------- 헤더 ---------- */
  function buildHeader() {
    var nav = MENU.map(function (m) {
      return '<a href="' + m.href + '" data-oc-page="' + m.href + '">' + m.label + '</a>';
    }).join('');

    var actions = tpl('oc-actions') ||
      '<button class="oc-icon-btn" type="button" aria-label="검색" id="oc-search-btn">' +
      '<span class="material-symbols-outlined">search</span></button>';

    return el(
      '<header class="oc-header">' +
        '<div class="oc-header-inner">' +
          '<a class="oc-logo" href="index.html">' + INFO.brand + '</a>' +
          '<nav class="oc-nav">' + nav + '</nav>' +
          '<div class="oc-header-actions">' + actions +
            '<button class="oc-icon-btn oc-menu-btn" type="button" aria-label="메뉴 열기" id="oc-menu-open">' +
            '<span class="material-symbols-outlined">menu</span></button>' +
          '</div>' +
        '</div>' +
      '</header>'
    );
  }

  /* ---------- 모바일 드롭다운 메뉴 (햄버거) ---------- */
  function buildDropdown() {
    var items = MENU.map(function (m) {
      return '<a href="' + m.href + '" data-oc-page="' + m.href + '">' +
             '<span class="material-symbols-outlined">' + m.icon + '</span>' + m.label + '</a>';
    }).join('');

    return el(
      '<div class="oc-dropdown" id="oc-dropdown">' +
        '<nav>' + items + tpl('oc-menu-extra') + '</nav>' +
      '</div>'
    );
  }

  /* ---------- 푸터 ---------- */
  function buildFooter() {
    return el(
      '<footer class="oc-footer">' +
        '<div class="oc-foot-wrap">' +
          '<div class="oc-cta">' +
            '<div class="oc-cta-text">' +
              '<p class="oc-cta-title">궁금하신 점이 있으신가요?</p>' +
              '<p class="oc-cta-tel">' + INFO.tel + '</p>' +
            '</div>' +
            '<div class="oc-cta-btns">' +
              '<a href="tel:' + INFO.tel + '">전화 연결</a>' +
              '<a href="sms:' + INFO.tel + '">문자 문의</a>' +
            '</div>' +
          '</div>' +
          '<div class="oc-foot-info-box">' +
            '<p class="oc-foot-name">' + INFO.company + '</p>' +
            '<div class="oc-foot-info">' +
              '<span>대표: ' + INFO.ceo + '</span>' +
              '<span class="oc-sep">|</span>' +
              '<span>등록번호: ' + INFO.reg + '</span>' +
              '<span class="oc-sep">|</span>' +
              '<span>주소: ' + INFO.addr + '</span>' +
              '<span class="oc-sep">|</span>' +
              '<span>대표전화: ' + INFO.telOffice + '</span>' +
            '</div>' +
            '<p class="oc-foot-copy">' + INFO.copyright + '</p>' +
          '</div>' +
        '</div>' +
      '</footer>'
    );
  }

  /* ---------- 모바일 하단 고정바 ---------- */
  function buildBottomNav() {
    return el(
      '<nav class="oc-bnav">' +
        '<a href="index.html" data-oc-page="index.html">' +
          '<span class="material-symbols-outlined">home</span>홈</a>' +
        '<a href="tel:' + INFO.tel + '">' +
          '<span class="material-symbols-outlined">call</span>전화상담</a>' +
        '<a href="listings.html" data-oc-page="listings.html">' +
          '<span class="material-symbols-outlined">search</span>매물찾기</a>' +
        '<a class="oc-bnav-cta" href="property-submit.html" data-oc-page="property-submit.html">' +
          '<span class="material-symbols-outlined">edit_note</span>매물접수</a>' +
      '</nav>'
    );
  }

  /* ---------- 현재 페이지 메뉴 강조 ----------
     하위 페이지는 상위 메뉴가 켜지도록 연결합니다.
     (매물 상세 → 매물찾기, 소식 작성 → 부동산소식)                    */
  var PARENT = {
    'property-detail.html': 'listings.html',
    'news-write.html': 'news.html'
  };

  function markActive() {
    var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (page === '') page = 'index.html';
    var key = PARENT[page] || page;

    var items = document.querySelectorAll('[data-oc-page]');
    for (var i = 0; i < items.length; i++) {
      var target = items[i].getAttribute('data-oc-page').toLowerCase();
      if (target === key || target === page) {
        items[i].classList.add('oc-active');
      }
    }
  }

  /* ---------- 조립 ---------- */
  function init() {
    var body = document.body;

    /* 관리자로 로그인한 상태면 oc-admin-only 요소들이 보이게 함 */
    try {
      if (sessionStorage.getItem('oc-admin-auth') === 'ok') {
        body.classList.add('oc-is-admin');
      }
    } catch (e) { /* 저장소를 못 쓰는 환경이면 감춘 채로 둡니다 */ }

    var header = buildHeader();
    header.appendChild(buildDropdown());
    body.insertBefore(header, body.firstChild);

    body.appendChild(buildFooter());
    if (showBottomNav) {
      body.appendChild(buildBottomNav());
    } else {
      body.classList.add('oc-no-bnav');
    }

    markActive();

    /* 스크롤을 내리면 헤더에 그림자가 생깁니다 */
    (function () {
      var head = document.querySelector('.oc-header');
      if (!head) return;
      function onScroll() {
        head.classList.toggle('oc-scrolled', window.scrollY > 8);
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    })();

    /* 돋보기 → 이 페이지에 검색창이 있으면 커서를 옮기고, 없으면 매물찾기로 이동 */
    var searchBtn = document.getElementById('oc-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function () {
        var box = document.getElementById('oc-search');
        if (box) {
          box.scrollIntoView({ block: 'center', behavior: 'smooth' });
          box.focus();
        } else {
          location.href = 'listings.html';
        }
      });
    }

    /* 햄버거 → 드롭다운 열고 닫기 */
    var btn = document.getElementById('oc-menu-open');
    var menu = document.getElementById('oc-dropdown');
    if (btn && menu) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        menu.classList.toggle('oc-open');
      });
      document.addEventListener('click', function (e) {
        if (!menu.contains(e.target)) menu.classList.remove('oc-open');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') menu.classList.remove('oc-open');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ============================================================
   매물찾기 목록
   · 관리자 페이지에 등록한 매물을 불러와 보여줍니다
   · 매물 종류 버튼과 검색창으로 함께 걸러볼 수 있습니다
   (등록/수정/삭제는 admin.html 에서 합니다)
   ============================================================ */

(function () {
  'use strict';

  var list    = document.getElementById('oc-list');
  var tiles   = document.getElementById('oc-tiles');
  var filters = document.getElementById('oc-filters');
  var empty   = document.getElementById('oc-search-empty');
  var input   = document.getElementById('oc-search');
  if (!list || typeof OceanDB === 'undefined') return;

  var BADGE = {
    '매매':  'bg-primary-container text-on-primary-container',
    '전세':  'bg-sub-blue-bg text-primary',
    '월세':  'bg-secondary-container text-white',
    '단기임대': 'bg-tertiary-container text-white'
  };
  var URGENT_BADGE = 'bg-danger text-white';

  /* 종류 타일 - 짧은 이름을 쓰고, 등록 폼의 종류와 여기서 연결합니다.
     타일에 없는 종류(오피스텔/원투룸, 단독/다가구/빌라, 토지)에 올린 매물도
     '전체' 에서는 빠짐없이 보입니다. */
  var TILES = [
    { key: '전체',     icon: 'grid_view',   cats: null },
    { key: '아파트',    icon: 'apartment',   cats: ['아파트', '아파트/주상복합'] },
    { key: '분양권',    icon: 'sell',        cats: ['아파트분양권', '분양권/입주권'] },
    { key: '상가',      icon: 'storefront',  cats: ['상가점포', '상가주택', '상가건물', '빌딩', '상가/사무실'] },
    { key: '오피스텔',  icon: 'domain',      cats: ['오피스텔', '오피스텔/원투룸', '원룸(방)'] },
    { key: '토지',      icon: 'landscape',   cats: ['토지/임야', '토지'] }
  ];

  /* 사진이 없을 때 보여줄 종류별 그림 */
  var CAT_ICON = {
    '아파트': 'apartment', '아파트/주상복합': 'apartment',
    '아파트분양권': 'sell', '분양권/입주권': 'sell',
    '오피스텔': 'domain', '오피스텔/원투룸': 'domain', '원룸(방)': 'door_front',
    '연립/다세대': 'holiday_village', '단독/다가구': 'house', '단독/다가구/빌라': 'house',
    '전원주택': 'cottage', '상가점포': 'storefront', '상가주택': 'storefront',
    '상가건물': 'store', '상가/사무실': 'storefront', '빌딩': 'corporate_fare',
    '창고': 'warehouse', '토지/임야': 'landscape', '토지': 'landscape',
    '생숙': 'hotel', '생활형숙박시설': 'hotel', '모텔': 'hotel', '펜션': 'cabin'
  };

  function catIcon(c) { return CAT_ICON[c] || 'home_work'; }

  /* ─────────────────────────────────────────────────────────────
     지역 목록 — 여기만 고치면 드롭다운이 바뀝니다.
     빼고 싶은 동은 줄을 지우고, 넣고 싶은 동은 따옴표로 감싸 추가하세요.
     ───────────────────────────────────────────────────────────── */
  var REGIONS = [
    /* 시내 */
    '강남동', '강문동', '견소동', '경포동', '교동', '금학동', '난곡동', '내곡동',
    '대전동', '두산동', '병산동', '성덕동', '송정동', '안현동', '옥천동', '운산동',
    '운정동', '월호평동', '유천동', '임당동', '저동', '죽헌동', '중앙동', '지변동',
    '초당동', '포남동', '학동', '홍제동',
    /* 읍·면 */
    '주문진읍', '강동면', '구정면', '사천면', '성산면', '연곡면', '옥계면', '왕산면'
  ];

  /* 거래 종류 목록 — 관리자 등록 폼의 '거래 종류' 와 같아야 합니다 */
  var DEALS = ['매매', '전세', '월세', '단기임대'];

  var state = { tile: '전체', q: '', region: '', deal: '' };
  var cards = [];                    /* { el, cat, region, deal, text } */

  /* 주소 전체를 담아 두고, 고른 지역이 주소 안에 들어 있는지로 맞춥니다.
     ('강원특별자치도 강릉시 주문진읍 교항리' 처럼 뒤에 리(里)가 붙어도 걸립니다) */
  function locOf(p) {
    return normalize((p && p.location) || '');
  }

  function tileOf(key) {
    for (var i = 0; i < TILES.length; i++) if (TILES[i].key === key) return TILES[i];
    return null;
  }

  function tileMatch(key, cat) {
    var t = tileOf(key);
    if (!t || !t.cats) return true;          /* 전체 */
    return t.cats.indexOf(cat) !== -1;
  }

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalize(t) {
    return String(t || '').toLowerCase().replace(/\s+/g, '');
  }

  /* ---------- 카드 ---------- */

  /* 한 줄짜리 제원이 카드 폭을 넘치면 글자를 조금씩 줄여 맞춥니다.
     엑셀의 "셀에 맞춤"과 같은 동작입니다. 자간을 먼저 좁히고, 그래도
     넘치면 글자 크기를 0.5px 씩 줄이되 11px 아래로는 내리지 않습니다
     (그보다 작으면 읽기 어렵습니다). */
  function fitSpecLines(root) {
    var MIN_PX = 11;
    var nodes = (root || document).querySelectorAll('[data-oc-fit]');
    Array.prototype.forEach.call(nodes, function (el) {
      el.style.letterSpacing = '';
      el.style.fontSize = '';
      if (el.scrollWidth <= el.clientWidth) return;

      el.style.letterSpacing = '-0.02em';
      if (el.scrollWidth <= el.clientWidth) return;

      var px = parseFloat(window.getComputedStyle(el).fontSize) || 14;
      while (px > MIN_PX && el.scrollWidth > el.clientWidth) {
        px -= 0.5;
        el.style.fontSize = px + 'px';
      }
    });
  }

  /* 화면에 그려지기 전에는 폭이 0이라 넘치는지 알 수 없습니다. 다음 프레임까지
     기다렸다가 맞추고, 웹폰트가 늦게 오면 글자 폭이 달라지므로 폰트가 준비된
     뒤에도 한 번 더 맞춥니다. */
  function scheduleFit(root) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { fitSpecLines(root); });
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { fitSpecLines(root); });
    }
  }

  /* 카드 폭은 창 크기에 따라 달라지므로 창이 바뀌면 다시 맞춥니다. */
  var fitTimer;
  window.addEventListener('resize', function () {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(function () { fitSpecLines(); }, 150);
  });

  function card(p) {
    var badgeStyle = BADGE[p.type] || 'bg-primary-container text-on-primary-container';
    var detailHref = 'property-detail.html?id=' + encodeURIComponent(p.id);
    var urgentTag = p.urgent
      ? '<span class="' + URGENT_BADGE + ' px-2 py-1 rounded-[8px] font-label-sm text-label-sm shadow-sm">급매</span>'
      : '';
    var hasVideo = !!(p.videoUrl && String(p.videoUrl).trim());
    var shots = (p.images && p.images.length) ? p.images : (p.imageUrl ? [p.imageUrl] : []);
    var shotCount = shots.length;
    var cover = shots[0] || '';
    var FALLBACK = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80';
    var features = String(p.features || '').trim();

    /* 제원은 첫 줄, 동·층은 그 아래 줄에 둔다.
       공급/전용은 한 줄에 다 들어가야 읽기 좋아서, 칸을 넘치면 아래
       fitSpecLines() 가 글자 크기를 조금씩 줄여 맞춘다(엑셀의 "셀에 맞춤"). */
    var specText = String(p.specs || '').trim();
    var unitText = String(p.unitPublic || '').trim();

    return '' +
      '<div class="oc-lift bg-card rounded-xl p-padding-container flex flex-col">' +

        /* 대표 사진 (없으면 예전처럼 배지 줄만 나옵니다) */
        (cover
          ? '<a href="' + detailHref + '" class="relative block w-full aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 mb-stack-sm">' +
              '<img src="' + esc(cover) + '" alt="' + esc(p.name) + '" loading="lazy" ' +
                'class="w-full h-full object-cover" ' +
                'onerror="this.src=\'' + FALLBACK + '\'">' +
              '<div class="absolute top-2 left-2 flex items-center gap-1">' + urgentTag +
                '<span class="' + badgeStyle + ' px-2 py-1 rounded-[8px] font-label-sm text-label-sm shadow-sm">' + esc(p.type || '매물') + '</span>' +
              '</div>' +
              '<div class="absolute top-2 right-2 flex items-center gap-1">' +
                (hasVideo
                  ? '<span class="flex items-center gap-1 text-[11px] font-bold text-primary bg-white/90 px-2 py-1 rounded-full">' +
                    '<span class="material-symbols-outlined text-[14px]">play_circle</span>영상</span>' : '') +
                (shotCount > 1
                  ? '<span class="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant bg-white/90 px-2 py-1 rounded-full">' +
                    '<span class="material-symbols-outlined text-[14px]">photo_library</span>' + shotCount + '</span>' : '') +
              '</div>' +
            '</a>'
          : /* 사진이 없으면 종류에 맞는 그림을 보여 줍니다 (사진 있는 카드와 높이가 같아집니다) */
            '<a href="' + detailHref + '" class="relative block w-full aspect-[4/3] rounded-lg overflow-hidden bg-surface-container ' +
                 'flex flex-col items-center justify-center gap-1.5 mb-stack-sm">' +
              '<span class="material-symbols-outlined text-[88px] leading-none text-on-surface-variant opacity-30">' + catIcon(p.category) + '</span>' +
              '<span class="text-[14px] font-bold text-on-surface-variant opacity-50">' + esc(p.category || '매물') + '</span>' +
              '<div class="absolute top-2 left-2 flex items-center gap-1">' + urgentTag +
                '<span class="' + badgeStyle + ' px-2 py-1 rounded-[8px] font-label-sm text-label-sm shadow-sm">' + esc(p.type || '매물') + '</span>' +
              '</div>' +
              (hasVideo
                ? '<div class="absolute top-2 right-2"><span class="flex items-center gap-1 text-[11px] font-bold text-primary bg-white/90 px-2 py-1 rounded-full">' +
                  '<span class="material-symbols-outlined text-[14px]">play_circle</span>영상</span></div>' : '') +
            '</a>') +

        '<div class="flex items-baseline gap-2 mb-2">' +
          '<h2 class="font-headline-md text-headline-md">' +
            '<a href="' + detailHref + '" class="hover:text-primary transition-colors">' + esc(p.name) + '</a>' +
          '</h2>' +
          (p.propertyNo ? '<span class="text-[11px] font-bold text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded shrink-0">' + esc(p.propertyNo) + '번</span>' : '') +
        '</div>' +
        (specText
          ? '<p class="text-body-text mb-0.5 whitespace-nowrap overflow-hidden" data-oc-fit>' +
              esc(specText) + '</p>'
          : '') +
        (unitText
          ? '<p class="text-body-text mb-1 whitespace-nowrap overflow-hidden" data-oc-fit>' +
              esc(unitText) + '</p>'
          : '') +
        '<div class="mb-stack-md">' +
          '<span class="font-headline-md text-headline-md text-primary font-bold">' + esc(p.price) + '</span>' +
        '</div>' +
        /* 매물 특징을 적었으면 그것만, 없을 때만 매물 설명을 보여 줍니다.
           둘 다 같은 글자 모양입니다 (알약 모양 배경 없음) */
        (features || p.description
          ? '<p class="text-body-text text-sm mb-3 flex-grow line-clamp-3 whitespace-pre-line">' +
              esc(features || p.description) + '</p>'
          : '<div class="flex-grow"></div>') +
        '<div class="flex gap-3">' +
          '<a class="flex-1 flex items-center justify-center bg-primary text-on-primary h-[48px] rounded-xl font-label-md text-label-md hover:bg-primary-container transition-colors oc-press shadow-sm" href="property-detail.html?id=' + encodeURIComponent(p.id) + '">자세히 보기</a>' +
          '<a href="tel:010-9254-7988" class="flex-1 flex items-center justify-center bg-surface-container-lowest border border-outline-variant text-primary h-[48px] rounded-xl font-label-md text-label-md hover:bg-surface-variant transition-colors active:scale-95 shadow-sm">전화 문의</a>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 종류 타일 ---------- */

  /* 그 타일을 골랐을 때 몇 건이 나오는지 (다른 조건은 그대로 둔 채 셉니다) */
  function countFor(key) {
    var q = normalize(state.q);
    var n = 0;
    cards.forEach(function (c) {
      if (!tileMatch(key, c.cat)) return;
      if (state.region && c.loc.indexOf(normalize(state.region)) === -1) return;
      if (state.deal && c.deal !== state.deal) return;
      if (q && c.text.indexOf(q) === -1) return;
      n++;
    });
    return n;
  }

  function drawTiles() {
    if (!tiles) return;

    tiles.innerHTML = TILES.map(function (t) {
      var on = state.tile === t.key;
      var n  = countFor(t.key);
      return '' +
        '<button type="button" data-tile="' + esc(t.key) + '" ' +
          'class="relative flex flex-col items-center justify-center gap-1.5 h-[92px] rounded-xl border transition-all active:scale-95 ' +
          (on ? 'bg-card border-primary shadow-sm text-on-surface'
              : 'bg-surface-container border-transparent text-on-surface-variant hover:bg-surface-variant') + '">' +
          '<span class="material-symbols-outlined text-[24px]">' + t.icon + '</span>' +
          '<span class="text-sm font-bold">' + esc(t.key) + '</span>' +
          (n > 0
            ? '<span class="absolute top-2 right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-white ' +
              'text-[11px] font-bold flex items-center justify-center">' + n + '</span>'
            : '') +
        '</button>';
    }).join('');
  }

  /* ---------- 지역 · 거래 필터 ---------- */

  function dropdown(name, label, current, list) {
    var shown = current || label;
    var items = [{ v: '', t: label + ' 전체' }].concat(list.map(function (v) {
      return { v: v, t: v };
    }));

    return '' +
      '<details class="oc-filter relative">' +
        '<summary class="cursor-pointer select-none inline-flex items-center gap-1 px-4 py-2 rounded-full border text-sm font-bold transition-colors ' +
          (current ? 'border-primary bg-sub-blue-bg text-primary'
                   : 'border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-variant') + '">' +
          esc(shown) +
          '<span class="material-symbols-outlined text-[18px]">expand_more</span>' +
        '</summary>' +
        '<div class="absolute left-0 z-20 mt-2 min-w-[170px] max-h-72 overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg py-1">' +
          items.map(function (o) {
            var on = (current || '') === o.v;
            return '<button type="button" data-filter="' + name + '" data-value="' + esc(o.v) + '" ' +
              'class="w-full text-left px-4 py-2 text-sm transition-colors ' +
              (on ? 'bg-sub-blue-bg text-primary font-bold' : 'text-on-surface hover:bg-gray-50') + '">' +
              esc(o.t) + '</button>';
          }).join('') +
        '</div>' +
      '</details>';
  }

  function drawFilters() {
    if (!filters) return;

    var html = '';
    html += dropdown('region', '지역', state.region, REGIONS);
    html += dropdown('deal',   '거래', state.deal,   DEALS);

    /* 고른 조건이 있으면 한 번에 지우는 버튼 */
    if (state.region || state.deal || state.q || state.tile !== '전체') {
      html += '<button type="button" id="oc-reset" class="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-sm font-bold ' +
              'text-on-surface-variant hover:bg-surface-variant transition-colors">' +
              '<span class="material-symbols-outlined text-[18px]">refresh</span>초기화</button>';
    }

    filters.innerHTML = html;
  }

  function redraw() {
    drawTiles();
    drawFilters();
    apply();
  }

  /* ---------- 걸러내기 (종류 + 지역 + 거래 + 검색어) ---------- */
  function apply() {
    var q = normalize(state.q);
    var shown = 0;

    cards.forEach(function (c) {
      var hit = tileMatch(state.tile, c.cat) &&
                (!state.region || c.loc.indexOf(normalize(state.region)) !== -1) &&
                (!state.deal   || c.deal   === state.deal) &&
                (q === '' || c.text.indexOf(q) !== -1);
      c.el.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });

    if (empty) empty.classList.toggle('hidden', shown > 0);
  }

  function message(text) {
    return '<div class="col-span-full py-16 text-center text-on-surface-variant font-body-md">' + text + '</div>';
  }

  /* ---------- 시작 ---------- */
  OceanDB.getProperties().then(function (props) {
    props = (props || []).filter(function (p) { return p && p.status !== '숨김'; });

    if (!props.length) {
      list.innerHTML = message('등록된 매물이 없습니다.');
      if (tiles) tiles.innerHTML = '';
      if (filters) filters.innerHTML = '';
      return;
    }

    list.innerHTML = props.map(card).join('');
    scheduleFit(list);
    list.classList.add('oc-stagger');
    /* 백그라운드 탭에서도 확실히 보이도록 (requestAnimationFrame 은 숨은 탭에서 멈춥니다) */
    setTimeout(function () { list.classList.add('oc-in'); }, 30);

    cards = [];
    var n = 0;
    for (var i = 0; i < list.children.length; i++) {
      if (list.children[i].nodeType !== 1) continue;
      var p = props[n++];
      cards.push({
        el: list.children[i],
        cat: (p && p.category) || '',
        loc: locOf(p),
        deal: (p && p.type) || '',
        text: normalize(list.children[i].innerText + ' ' + ((p && p.category) || '') +
                        ' ' + ((p && p.propertyNo) || '') + ' ' + ((p && p.naverNo) || ''))
      });
    }

    redraw();
  }).catch(function () {
    list.innerHTML = message('매물을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  });

  /* ---------- 타일 · 필터 클릭 ---------- */
  function closeDropdowns(except) {
    Array.prototype.forEach.call(document.querySelectorAll('.oc-filter[open]'), function (d) {
      if (d !== except) d.removeAttribute('open');
    });
  }

  document.addEventListener('click', function (e) {
    var tileBtn = e.target.closest && e.target.closest('[data-tile]');
    if (tileBtn) {
      state.tile = tileBtn.getAttribute('data-tile');
      redraw();
      return;
    }

    var opt = e.target.closest && e.target.closest('[data-filter]');
    if (opt) {
      state[opt.getAttribute('data-filter')] = opt.getAttribute('data-value');
      closeDropdowns();
      redraw();
      return;
    }

    if (e.target.closest && e.target.closest('#oc-reset')) {
      state.tile = '전체';
      state.region = '';
      state.deal = '';
      state.q = '';
      if (input) input.value = '';
      redraw();
      return;
    }

    /* 드롭다운 밖을 누르면 닫습니다 */
    var inside = e.target.closest && e.target.closest('.oc-filter');
    closeDropdowns(inside);
  });

  /* ---------- 검색창 ---------- */
  if (input) {
    input.addEventListener('input', function () {
      state.q = input.value;
      redraw();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = ''; state.q = ''; redraw(); }
    });
  }
})();

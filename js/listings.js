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
    '급매':  'bg-danger text-white',
    '매매':  'bg-primary-container text-on-primary-container',
    '전세':  'bg-sub-blue-bg text-primary',
    '월세':  'bg-secondary-container text-white'
  };

  /* 종류 타일 - 짧은 이름을 쓰고, 등록 폼의 종류와 여기서 연결합니다.
     타일에 없는 종류(오피스텔/원투룸, 단독/다가구/빌라, 토지)에 올린 매물도
     '전체' 에서는 빠짐없이 보입니다. */
  var TILES = [
    { key: '전체',           icon: 'grid_view',   cats: null },
    { key: '아파트',          icon: 'apartment',   cats: ['아파트/주상복합'] },
    { key: '분양권',          icon: 'sell',        cats: ['분양권/입주권'] },
    { key: '생활형숙박시설',   icon: 'hotel',       cats: ['생활형숙박시설'] },
    { key: '상가',            icon: 'storefront',  cats: ['상가/사무실'] }
  ];

  var state = { tile: '전체', q: '', region: '', deal: '' };
  var cards = [];                    /* { el, cat, region, deal, text } */

  /* 주소에서 동 이름만 (예: '강원특별자치도 강릉시 견소동' -> '견소동') */
  function regionOf(p) {
    var parts = String((p && p.location) || '').trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
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
  function card(p) {
    var badgeStyle = BADGE[p.type] || 'bg-primary-container text-on-primary-container';
    var hasVideo = !!(p.videoUrl && String(p.videoUrl).trim());
    var shotCount = (p.images && p.images.length) ? p.images.length : (p.imageUrl ? 1 : 0);
    var tags = String(p.features || '').split(/[,·]/)
      .map(function (t) { return t.trim(); }).filter(Boolean);

    /* 상세 제원과 동·층을 한 줄로 (예: 116㎡ / 102동 6층) */
    var specLine = [p.specs, p.unitPublic]
      .map(function (v) { return String(v || '').trim(); })
      .filter(Boolean)
      .join(' / ');

    return '' +
      '<div class="oc-lift bg-card rounded-xl p-padding-container flex flex-col">' +
        '<div class="flex justify-between items-start mb-stack-sm">' +
          '<span class="' + badgeStyle + ' px-2 py-1 rounded-[8px] font-label-sm text-label-sm shadow-sm">' + esc(p.type || '매물') + '</span>' +
          '<div class="flex items-center gap-1">' +
            (hasVideo
              ? '<span class="flex items-center gap-1 text-[11px] font-bold text-primary bg-sub-blue-bg px-2 py-1 rounded-full">' +
                '<span class="material-symbols-outlined text-[14px]">play_circle</span>영상</span>' : '') +
            (shotCount > 1
              ? '<span class="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-full">' +
                '<span class="material-symbols-outlined text-[14px]">photo_library</span>' + shotCount + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<h2 class="font-headline-md text-headline-md mb-2">' + esc(p.name) + '</h2>' +
        (specLine ? '<p class="text-body-text mb-1">' + esc(specLine) + '</p>' : '') +
        '<div class="mb-stack-md">' +
          '<span class="font-headline-md text-headline-md text-primary font-bold">' + esc(p.price) + '</span>' +
        '</div>' +
        (tags.length
          ? '<div class="flex flex-wrap gap-1 mb-stack-sm">' + tags.map(function (t) {
              return '<span class="text-[11px] font-semibold text-primary bg-sub-blue-bg px-2 py-0.5 rounded-full">' + esc(t) + '</span>';
            }).join('') + '</div>'
          : '') +
        (p.description
          ? '<p class="text-body-text text-sm mb-stack-lg flex-grow line-clamp-3 whitespace-pre-line">' + esc(p.description) + '</p>'
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
      if (state.region && c.region !== state.region) return;
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

  function options(getter) {
    var seen = [];
    cards.forEach(function (c) {
      var v = getter(c);
      if (v && seen.indexOf(v) === -1) seen.push(v);
    });
    return seen.sort();
  }

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

    var regions = options(function (c) { return c.region; });
    var deals   = options(function (c) { return c.deal; });

    var html = '';
    if (regions.length > 1) html += dropdown('region', '지역', state.region, regions);
    if (deals.length   > 1) html += dropdown('deal',   '거래', state.deal,   deals);

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
                (!state.region || c.region === state.region) &&
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
        region: regionOf(p),
        deal: (p && p.type) || '',
        text: normalize(list.children[i].innerText + ' ' + ((p && p.category) || ''))
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

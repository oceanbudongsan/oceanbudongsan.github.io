/* ============================================================
   매물찾기 목록
   · 관리자 페이지에 등록한 매물을 불러와 보여줍니다
   · 매물 종류 버튼과 검색창으로 함께 걸러볼 수 있습니다
   (등록/수정/삭제는 admin.html 에서 합니다)
   ============================================================ */

(function () {
  'use strict';

  var list  = document.getElementById('oc-list');
  var cats  = document.getElementById('oc-cats');
  var empty = document.getElementById('oc-search-empty');
  var input = document.getElementById('oc-search');
  if (!list || typeof OceanDB === 'undefined') return;

  var BADGE = {
    '급매':  'bg-danger text-white',
    '매매':  'bg-primary-container text-on-primary-container',
    '전세':  'bg-sub-blue-bg text-primary',
    '월세':  'bg-secondary-container text-white'
  };

  var state = { cat: '전체', q: '' };
  var cards = [];                    /* { el, cat, text } */

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
        (p.specs ? '<p class="text-body-text mb-1">' + esc(p.specs) + '</p>' : '') +
        (p.unitPublic ? '<p class="text-body-text text-sm mb-1">' + esc(p.unitPublic) + '</p>' : '') +
        '<div class="mb-stack-md">' +
          '<span class="font-headline-md text-headline-md text-primary font-bold">' + esc(p.price) + '</span>' +
        '</div>' +
        (tags.length
          ? '<div class="flex flex-wrap gap-1 mb-stack-sm">' + tags.map(function (t) {
              return '<span class="text-[11px] font-semibold text-primary bg-sub-blue-bg px-2 py-0.5 rounded-full">' + esc(t) + '</span>';
            }).join('') + '</div>'
          : '') +
        (p.description
          ? '<p class="text-body-text text-sm mb-stack-lg flex-grow">' + esc(p.description) + '</p>'
          : '<div class="flex-grow"></div>') +
        '<div class="flex gap-3">' +
          '<a class="flex-1 flex items-center justify-center bg-primary text-on-primary h-[48px] rounded-xl font-label-md text-label-md hover:bg-primary-container transition-colors oc-press shadow-sm" href="property-detail.html?id=' + encodeURIComponent(p.id) + '">자세히 보기</a>' +
          '<a href="tel:010-9254-7988" class="flex-1 flex items-center justify-center bg-surface-container-lowest border border-outline-variant text-primary h-[48px] rounded-xl font-label-md text-label-md hover:bg-surface-variant transition-colors active:scale-95 shadow-sm">전화 문의</a>' +
        '</div>' +
      '</div>';
  }

  /* ---------- 매물 종류 버튼 ---------- */
  function paintCats() {
    if (!cats) return;
    Array.prototype.forEach.call(cats.querySelectorAll('.oc-cat-btn'), function (b) {
      var on = b.getAttribute('data-cat') === state.cat;
      b.className = 'oc-cat-btn shrink-0 px-5 py-2.5 rounded-full font-label-md text-label-md transition-colors active:scale-95 ' +
        (on ? 'bg-primary text-on-primary shadow-sm'
            : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant');
    });
  }

  function drawCats(props) {
    if (!cats) return;

    var seen = [];
    props.forEach(function (p) {
      var c = (p.category || '').trim();
      if (c && seen.indexOf(c) === -1) seen.push(c);
    });

    /* 종류가 한 가지뿐이면 버튼을 보여줄 이유가 없습니다 */
    if (seen.length < 2) { cats.innerHTML = ''; return; }

    cats.innerHTML = ['전체'].concat(seen).map(function (c) {
      return '<button type="button" data-cat="' + esc(c) + '" class="oc-cat-btn">' + esc(c) + '</button>';
    }).join('');

    Array.prototype.forEach.call(cats.querySelectorAll('.oc-cat-btn'), function (b) {
      b.addEventListener('click', function () {
        state.cat = b.getAttribute('data-cat');
        paintCats();
        apply();
      });
    });
    paintCats();
  }

  /* ---------- 걸러내기 (종류 + 검색어 동시 적용) ---------- */
  function apply() {
    var q = normalize(state.q);
    var shown = 0;

    cards.forEach(function (c) {
      var okCat  = (state.cat === '전체') || (c.cat === state.cat);
      var okText = (q === '') || (c.text.indexOf(q) !== -1);
      var hit = okCat && okText;
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
      if (cats) cats.innerHTML = '';
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
        text: normalize(list.children[i].innerText + ' ' + ((p && p.category) || ''))
      });
    }

    drawCats(props);
    apply();
  }).catch(function () {
    list.innerHTML = message('매물을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  });

  /* ---------- 검색창 ---------- */
  if (input) {
    input.addEventListener('input', function () {
      state.q = input.value;
      apply();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = ''; state.q = ''; apply(); }
    });
  }
})();

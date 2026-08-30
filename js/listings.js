/* ============================================================
   매물찾기 목록 - 관리자 페이지에 등록한 매물을 불러와 보여줍니다.
   (등록/수정/삭제는 admin.html 에서 합니다)
   ============================================================ */

(function () {
  'use strict';

  var list = document.getElementById('oc-list');
  if (!list || typeof OceanDB === 'undefined') return;

  var BADGE = {
    '급매':  'bg-danger text-white',
    '매매':  'bg-primary-container text-on-primary-container',
    '전세':  'bg-sub-blue-bg text-primary',
    '월세':  'bg-secondary-container text-white'
  };

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function card(p) {
    var badgeStyle = BADGE[p.type] || 'bg-primary-container text-on-primary-container';
    var hasVideo = !!(p.videoUrl && String(p.videoUrl).trim());
    var shotCount = (p.images && p.images.length) ? p.images.length : (p.imageUrl ? 1 : 0);

    return '' +
      '<div class="bg-card rounded-xl p-padding-container flex flex-col hover:shadow-lg transition-shadow duration-200">' +
        '<div class="flex justify-between items-start mb-stack-sm">' +
          '<span class="' + badgeStyle + ' px-2 py-1 rounded-[8px] font-label-sm text-label-sm shadow-sm">' + esc(p.type || '매물') + '</span>' +
          (hasVideo
            ? '<span class="flex items-center gap-1 text-[11px] font-bold text-primary bg-sub-blue-bg px-2 py-1 rounded-full">' +
              '<span class="material-symbols-outlined text-[14px]">play_circle</span>영상</span>'
            : '') +
          (shotCount > 1
            ? '<span class="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-full ml-1">' +
              '<span class="material-symbols-outlined text-[14px]">photo_library</span>' + shotCount + '</span>'
            : '') +
        '</div>' +
        '<h2 class="font-headline-md text-headline-md mb-2">' + esc(p.name) + '</h2>' +
        (p.specs ? '<p class="text-body-text mb-1">' + esc(p.specs) + '</p>' : '') +
        (p.unitPublic ? '<p class="text-body-text text-sm mb-1">' + esc(p.unitPublic) + '</p>' : '') +
        '<div class="mb-stack-md">' +
          '<span class="font-headline-md text-headline-md text-primary font-bold">' + esc(p.price) + '</span>' +
        '</div>' +
        (p.features ? '<div class="flex flex-wrap gap-1 mb-stack-sm">' +
           String(p.features).split(/[,·]/).map(function (t) { return t.trim(); }).filter(Boolean)
             .map(function (t) { return '<span class="text-[11px] font-semibold text-primary bg-sub-blue-bg px-2 py-0.5 rounded-full">' + esc(t) + '</span>'; }).join('') +
           '</div>' : '') +
        (p.description ? '<p class="text-body-text text-sm mb-stack-lg flex-grow">' + esc(p.description) + '</p>' : '<div class="flex-grow"></div>') +
        '<div class="flex gap-3">' +
          '<a class="flex-1 flex items-center justify-center bg-primary text-on-primary h-[48px] rounded-xl font-label-md text-label-md hover:bg-primary-container transition-colors active:scale-95 shadow-sm" href="property-detail.html?id=' + encodeURIComponent(p.id) + '">자세히 보기</a>' +
          '<a href="tel:010-9254-7988" class="flex-1 flex items-center justify-center bg-surface-container-lowest border border-outline-variant text-primary h-[48px] rounded-xl font-label-md text-label-md hover:bg-surface-variant transition-colors active:scale-95 shadow-sm">전화 문의</a>' +
        '</div>' +
      '</div>';
  }

  function message(text) {
    return '<div class="col-span-full py-16 text-center text-on-surface-variant font-body-md">' + text + '</div>';
  }

  OceanDB.getProperties().then(function (props) {
    props = (props || []).filter(function (p) {
      return p && p.status !== '숨김';
    });

    if (!props.length) {
      list.innerHTML = message('등록된 매물이 없습니다.');
      return;
    }

    list.innerHTML = props.map(card).join('');

    /* 목록이 새로 그려졌으니 검색창이 다시 인식하도록 알립니다 */
    document.dispatchEvent(new CustomEvent('oc:list-rendered'));
  }).catch(function () {
    list.innerHTML = message('매물을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  });
})();

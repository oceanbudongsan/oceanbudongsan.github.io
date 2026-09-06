/* ============================================================
   매물 상세페이지 - 주소에 ?id=... 가 붙어 있으면
   그 매물의 내용으로 화면을 채웁니다.

   ?id 가 없으면 페이지에 원래 적혀 있는 예시 내용이 그대로 보입니다.
   ============================================================ */

(function () {
  'use strict';

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  }

  var id = param('id');
  if (!id || typeof OceanDB === 'undefined') return;

  var $ = function (sel) { return document.querySelector(sel); };

  /* 실제 자료가 없는 예시 칸들은 감춥니다 (허위 정보 방지) */
  function hideSamples() {
    ['#oc-d-imgcount', '#oc-d-floorplan', '#oc-d-listings', '#oc-d-around'].forEach(function (sel) {
      var el = $(sel);
      if (el) el.style.display = 'none';
    });
  }

  function notFound() {
    var main = document.querySelector('main');
    if (!main) return;
    main.innerHTML =
      '<div class="bg-card rounded-xl p-padding-container shadow-sm text-center py-16 flex flex-col items-center gap-4">' +
        '<span class="material-symbols-outlined text-5xl text-outline-variant">search_off</span>' +
        '<p class="font-headline-md text-headline-md text-on-surface">매물을 찾을 수 없습니다</p>' +
        '<p class="font-body-md text-body-md text-body-text">이미 거래가 완료되었거나 삭제된 매물일 수 있습니다.</p>' +
        '<a href="listings.html" class="mt-2 inline-flex items-center justify-center h-[48px] px-6 rounded-xl bg-primary text-on-primary font-label-md">매물 목록으로</a>' +
      '</div>';
  }

  function fill(p) {
    hideSamples();

    /* 사진 - 여러 장이면 넘겨보는 슬라이드로 만듭니다 */
    var shots = (p.images && p.images.length) ? p.images : (p.imageUrl ? [p.imageUrl] : []);
    var gallery = $('#oc-gallery');
    if (gallery && shots.length && typeof OceanGallery !== 'undefined') {
      OceanGallery.render(gallery, shots, p.name);
    } else {
      var img = $('#oc-d-image');
      if (img && p.imageUrl) {
        img.src = p.imageUrl;
        img.alt = p.name || '매물 사진';
      }
    }

    var badge = $('#oc-d-badge');
    if (badge) badge.textContent = (p.urgent ? '급매 · ' : '') + (p.type || p.badge || '매물');

    /* 제목에 동·층까지 함께 보여줍니다 (예: 강릉오션시티아이피크 102동 6층) */
    var name = $('#oc-d-name');
    if (name) {
      name.textContent = (p.name || '매물') + (p.unitPublic ? ' ' + p.unitPublic : '');
    }

    var loc = $('#oc-d-location-text');
    if (loc) loc.textContent = p.location || '';

    /* 관리자로 로그인했을 때만 보이는 수정 버튼 */
    var editBtn = $('#oc-d-edit');
    if (editBtn) editBtn.href = 'admin.html?edit=' + encodeURIComponent(p.id);

    /* 준공년월·세대수 같은 예시 항목 자리에 실제 정보를 넣습니다 */
    var specs = $('#oc-d-specs');
    if (specs) {
      var rows = [];
      if (p.propertyNo) rows.push(['매물번호', p.propertyNo]);
      if (p.price) rows.push(['매매가', p.price]);
      /* 동·층은 제목에 이미 있으므로 표에서는 뺍니다 */
      if (p.specs) {
        /* '공급 108.56㎡ / 전용 84.96㎡' 처럼 적혀 있으면 두 줄로 나눕니다 */
        var area = String(p.specs);
        rows.push(['면적(평형)',
          (/공급|전용/.test(area) ? area.split(/\s*\/\s*/).filter(Boolean) : [area])]);
      }
      if (p.category) rows.push(['구분', p.category]);
      if (p.type) rows.push(['거래 종류', p.type]);

      if (!rows.length) {
        specs.style.display = 'none';
      } else {
        specs.innerHTML = rows.map(function (r) {
          var lines = Array.isArray(r[1]) ? r[1] : [r[1]];
          return '<div class="flex flex-col">' +
                   '<span class="font-label-sm text-label-sm text-on-surface-variant">' + esc(r[0]) + '</span>' +
                   '<span class="font-label-md text-label-md text-on-surface mt-1">' +
                     lines.map(esc).join('<br>') +
                   '</span>' +
                 '</div>';
        }).join('');
      }
    }

    /* 매물 특징 - 왼쪽에 파란 선을 두고 크고 굵은 글자로 보여줍니다 */
    var feat = $('#oc-d-features');
    if (feat) {
      var features = String(p.features || '').trim();
      if (features) {
        feat.innerHTML =
          '<div class="border-l-4 border-primary pl-4 py-0.5">' +
            '<p class="text-[18px] font-bold text-on-surface leading-relaxed m-0 whitespace-pre-line">' +
              esc(features) +
            '</p>' +
          '</div>';
        feat.parentElement.style.display = '';
      } else {
        feat.parentElement.style.display = 'none';
      }
    }

    /* 매물 설명 */
    var desc = $('#oc-d-description');
    if (desc) {
      if (p.description) {
        desc.textContent = p.description;
        desc.parentElement.style.display = '';
      } else {
        desc.parentElement.style.display = 'none';
      }
    }

    /* 영상 */
    var vbox = $('#oc-video-section [data-oc-video]');
    var vsec = $('#oc-video-section');
    if (vbox && vsec) {
      /* data-url 을 먼저 채워둡니다.
         (영상 그리기가 나중에 한 번 더 돌아도 지워지지 않도록)   */
      vbox.setAttribute('data-url', p.videoUrl || '');

      if (p.videoUrl && typeof OceanVideo !== 'undefined' && OceanVideo.render(vbox, p.videoUrl)) {
        vsec.style.display = '';
      } else {
        vsec.style.display = 'none';
      }
    }

    document.title = '오션부동산 - ' + (p.name || '매물 상세') +
                     (p.unitPublic ? ' ' + p.unitPublic : '');
  }

  OceanDB.getProperties().then(function (props) {
    var found = (props || []).filter(function (p) {
      return String(p.id) === String(id);
    })[0];

    if (found) fill(found);
    else notFound();
  }).catch(notFound);
})();

/* ============================================================
   매물 사진 슬라이드
   · 좌우 화살표, 손가락으로 밀기, 키보드 방향키로 넘길 수 있습니다
   · 사진이 한 장뿐이면 화살표와 장수 표시가 나타나지 않습니다

   쓰는 법
     OceanGallery.render(자리, ['사진주소1','사진주소2', ...], '매물명');
   ============================================================ */

window.OceanGallery = (function () {
  'use strict';

  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function render(box, images, title) {
    if (!box) return false;

    images = (images || []).filter(function (u) { return u && String(u).trim(); });
    if (!images.length) return false;

    var many = images.length > 1;
    var name = esc(title || '매물 사진');

    var arrow =
      'position:absolute;top:50%;transform:translateY(-50%);z-index:2;' +
      'width:44px;height:44px;border:0;border-radius:999px;cursor:pointer;' +
      'background:rgba(255,255,255,.92);box-shadow:0 2px 10px rgba(0,0,0,.18);' +
      'display:flex;align-items:center;justify-content:center;color:#191f28;';

    box.innerHTML =
      '<div class="oc-gal-track" style="position:absolute;inset:0;">' +
        images.map(function (src, i) {
          return '<img src="' + esc(src) + '" alt="' + name + ' 사진 ' + (i + 1) + '" ' +
                 'class="oc-gal-img" loading="' + (i === 0 ? 'eager' : 'lazy') + '" ' +
                 'style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
                 'opacity:' + (i === 0 ? '1' : '0') + ';transition:opacity .25s ease;">';
        }).join('') +
      '</div>' +
      (many
        ? '<button type="button" class="oc-gal-prev" aria-label="이전 사진" style="' + arrow + 'left:12px;">' +
            '<span class="material-symbols-outlined">chevron_left</span></button>' +
          '<button type="button" class="oc-gal-next" aria-label="다음 사진" style="' + arrow + 'right:12px;">' +
            '<span class="material-symbols-outlined">chevron_right</span></button>' +
          '<div class="oc-gal-count" style="position:absolute;bottom:14px;right:14px;z-index:2;' +
            'background:rgba(0,0,0,.55);color:#fff;padding:5px 12px;border-radius:999px;' +
            'font-size:13px;font-weight:600;">1 / ' + images.length + '</div>'
        : '');

    if (!many) return true;

    var imgs = box.querySelectorAll('.oc-gal-img');
    var count = box.querySelector('.oc-gal-count');
    var at = 0;

    function show(next) {
      at = (next + images.length) % images.length;
      for (var i = 0; i < imgs.length; i++) {
        imgs[i].style.opacity = (i === at) ? '1' : '0';
      }
      count.textContent = (at + 1) + ' / ' + images.length;
    }

    box.querySelector('.oc-gal-prev').addEventListener('click', function () { show(at - 1); });
    box.querySelector('.oc-gal-next').addEventListener('click', function () { show(at + 1); });

    /* 손가락으로 밀어서 넘기기 */
    var startX = null;
    box.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
    }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) show(dx < 0 ? at + 1 : at - 1);
      startX = null;
    });

    /* 키보드 방향키 */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(at - 1);
      if (e.key === 'ArrowRight') show(at + 1);
    });

    return true;
  }

  return { render: render };
})();

/* ============================================================
   매물 영상 넣기 (유튜브)

   쓰는 법 - HTML 에 이렇게 자리를 만들어 두면 됩니다.

     <div data-oc-video data-url="https://youtu.be/영상주소"></div>

   · data-url 이 비어 있으면 그 자리는 자동으로 사라집니다
   · 유튜브 주소는 어떤 형태든 알아서 인식합니다
       https://youtu.be/abc123
       https://www.youtube.com/watch?v=abc123
       https://www.youtube.com/shorts/abc123   (세로 영상)
   · 세로 영상(쇼츠)은 자동으로 세로 화면에 맞춰 표시됩니다
   ============================================================ */

window.OceanVideo = (function () {
  'use strict';

  /* 주소에서 영상 번호만 뽑아냅니다 */
  function parse(url) {
    if (!url) return null;
    var u = String(url).trim();
    if (!u) return null;

    var portrait = /\/shorts\//i.test(u);
    var id = null;

    var m =
      u.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ||          // watch?v=
      u.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ||      // youtu.be/
      u.match(/\/shorts\/([A-Za-z0-9_-]{6,})/) ||       // shorts/
      u.match(/\/embed\/([A-Za-z0-9_-]{6,})/);          // embed/

    if (m) id = m[1];
    else if (/^[A-Za-z0-9_-]{6,}$/.test(u)) id = u;     // 영상 번호만 붙여넣은 경우

    if (!id) return null;
    return { id: id, portrait: portrait };
  }

  /* 한 자리에 영상을 그립니다 */
  function render(box, url) {
    if (!box) return false;

    var info = parse(url);
    if (!info) {              // 주소가 없거나 잘못되면 자리를 숨깁니다
      box.style.display = 'none';
      return false;
    }

    box.style.display = '';
    box.innerHTML =
      '<div style="position:relative;width:100%;' +
      (info.portrait ? 'max-width:340px;margin:0 auto;padding-top:177.78%;' : 'padding-top:56.25%;') +
      'border-radius:14px;overflow:hidden;background:#000;">' +
        '<iframe src="https://www.youtube.com/embed/' + info.id + '?rel=0" ' +
        'title="매물 영상" loading="lazy" allowfullscreen ' +
        'allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
        'referrerpolicy="strict-origin-when-cross-origin" ' +
        'style="position:absolute;inset:0;width:100%;height:100%;border:0;"></iframe>' +
      '</div>';
    return true;
  }

  /* 페이지에 있는 자리를 모두 찾아 그립니다 */
  function init() {
    var boxes = document.querySelectorAll('[data-oc-video]');
    for (var i = 0; i < boxes.length; i++) {
      render(boxes[i], boxes[i].getAttribute('data-url'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { render: render, parse: parse, init: init };
})();

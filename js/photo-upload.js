/* ============================================================
   매물 사진 올리기
   · 컴퓨터에서 사진을 고르면 자동으로 GitHub 저장소에 올라가고
     주소가 입력칸에 채워집니다.
   · 큰 사진은 자동으로 줄여서 올립니다 (가로 1200px, 화질 82%)
     스마트폰 원본 5MB 짜리가 보통 200~400KB 로 줄어듭니다.

   쓰는 법
     OceanPhoto.attach(파일선택input, 주소가들어갈textarea, 안내문구자리);
   ============================================================ */

window.OceanPhoto = (function () {
  'use strict';

  var MAX_WIDTH = 1200;   // 가로 최대 크기
  var QUALITY   = 0.82;   // 화질 (0~1)
  var FOLDER    = 'images';

  /* 사진을 줄여서 base64 로 만듭니다 */
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('사진을 읽지 못했습니다')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('사진 형식을 알 수 없습니다')); };
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > MAX_WIDTH) {
            h = Math.round(h * (MAX_WIDTH / w));
            w = MAX_WIDTH;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);

          var dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
          resolve({
            base64: dataUrl.split(',')[1],
            bytes: Math.round(dataUrl.length * 0.75)
          });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* GitHub 저장소에 파일 하나를 올립니다 */
  function push(path, base64, message) {
    var c = OceanDB.config;
    var url = 'https://api.github.com/repos/' + c.owner + '/' + c.repo + '/contents/' + path;

    return fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + c.token,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({ message: message, content: base64, branch: c.branch })
    }).then(function (res) {
      if (res.ok) return res.json();
      return res.json().catch(function () { return {}; }).then(function (e) {
        throw new Error(e.message || ('올리기 실패 (' + res.status + ')'));
      });
    });
  }

  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
           '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  /* 글자 입력칸의 커서 위치에 끼워 넣습니다 */
  function insertAtCursor(box, text) {
    var start = box.selectionStart;
    var end = box.selectionEnd;
    if (typeof start !== 'number') {           // 커서 위치를 모르면 맨 뒤에 붙입니다
      box.value += (box.value ? '\n' : '') + text;
      return;
    }
    box.value = box.value.slice(0, start) + text + box.value.slice(end);
    var at = start + text.length;
    box.focus();
    box.setSelectionRange(at, at);
  }

  function imgTag(path) {
    return '<img src="' + path + '" alt="" ' +
           'style="max-width:100%;height:auto;border-radius:12px;margin:14px 0;display:block;">';
  }

  /* options.mode
       'lines'  (기본) 주소를 한 줄씩 적어 넣습니다  - 매물 사진용
       'insert'        커서 자리에 사진을 끼워 넣습니다 - 소식 본문용        */
  function attach(fileInput, textarea, statusBox, options) {
    if (!fileInput || !textarea) return;
    var mode = (options && options.mode) || 'lines';

    function say(text, color) {
      if (!statusBox) return;
      statusBox.textContent = text;
      statusBox.style.color = color || '#6b7684';
    }

    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      if (!files.length) return;

      if (typeof OceanDB === 'undefined' || !OceanDB.isGitHubConfigured()) {
        say('먼저 GitHub 연동 설정을 해주세요. 사진을 저장할 곳이 없습니다.', '#e42939');
        fileInput.value = '';
        return;
      }

      var done = 0, added = [], failed = 0;
      say('사진 ' + files.length + '장을 올리는 중입니다...');

      /* 한 장씩 차례로 올립니다 (동시에 올리면 저장소가 충돌합니다) */
      files.reduce(function (chain, file, i) {
        return chain.then(function () {
          say('(' + (done + 1) + '/' + files.length + ') ' + file.name + ' 처리 중...');

          return shrink(file).then(function (out) {
            var path = FOLDER + '/' + stamp() + '-' + (i + 1) + '.jpg';
            return push(path, out.base64, '[사진] ' + file.name).then(function () {
              added.push(path);
              done++;
              say('(' + done + '/' + files.length + ') 완료 · ' +
                  Math.round(out.bytes / 1024) + 'KB 로 줄여서 올렸습니다');
            });
          }).catch(function (err) {
            failed++;
            say(file.name + ' 실패: ' + err.message, '#e42939');
          });
        });
      }, Promise.resolve()).then(function () {
        if (added.length) {
          if (mode === 'insert') {
            insertAtCursor(textarea, '\n' + added.map(imgTag).join('\n') + '\n');
          } else {
            var now = textarea.value.trim();
            textarea.value = (now ? now + '\n' : '') + added.join('\n');
          }
        }
        fileInput.value = '';

        if (failed) {
          say(added.length + '장 완료, ' + failed + '장 실패했습니다.', '#e42939');
        } else {
          say(added.length + '장 올렸습니다. 홈페이지에 반영되기까지 1~2분 걸립니다.', '#0059b9');
        }
      });
    });
  }

  return { attach: attach, shrink: shrink };
})();

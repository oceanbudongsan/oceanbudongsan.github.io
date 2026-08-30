/* ============================================================
   사진 올리기 (매물 사진 · 소식 본문 공용)

   사진을 넣는 방법 세 가지
     1. 버튼을 눌러 컴퓨터에서 고르기
     2. 사진 파일을 입력칸으로 끌어다 놓기
     3. 복사한 사진을 Ctrl+V 로 붙여넣기

   큰 사진은 자동으로 줄여서 올립니다 (가로 1200px, 화질 82%)
   스마트폰 원본 5MB 짜리가 보통 200~400KB 로 줄어듭니다.

   쓰는 법
     OceanPhoto.attach(파일선택input, 입력칸, 안내문구자리, { mode: 'lines' });
       mode 'lines'  - 주소를 한 줄씩 적어 넣습니다 (매물 사진)
       mode 'insert' - 커서 자리에 사진을 끼워 넣습니다 (소식 본문)
   ============================================================ */

window.OceanPhoto = (function () {
  'use strict';

  var MAX_WIDTH = 1200;
  var QUALITY   = 0.82;
  var FOLDER    = 'images';

  /* ---------- 사진 줄이기 ---------- */
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
          resolve({ base64: dataUrl.split(',')[1], bytes: Math.round(dataUrl.length * 0.75) });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- GitHub 저장소에 올리기 ---------- */
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
           '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) +
           '-' + Math.floor(Math.random() * 1000);
  }

  /* ---------- 입력칸에 넣기 ---------- */
  function insertAtCursor(box, text) {
    var start = box.selectionStart;
    var end = box.selectionEnd;
    if (typeof start !== 'number') {
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

  /* ---------- 실제 처리 ---------- */
  function handle(files, textarea, statusBox, mode) {
    files = Array.prototype.slice.call(files || []).filter(function (f) {
      return f && f.type && f.type.indexOf('image/') === 0;
    });
    if (!files.length) return Promise.resolve();

    function say(text, color) {
      if (!statusBox) return;
      statusBox.textContent = text;
      statusBox.style.color = color || '#6b7684';
    }

    if (typeof OceanDB === 'undefined' || !OceanDB.isGitHubConfigured()) {
      say('먼저 GitHub 연동 설정을 해주세요. 사진을 저장할 곳이 없습니다.', '#e42939');
      return Promise.resolve();
    }

    var done = 0, added = [], failed = 0;
    say('사진 ' + files.length + '장을 올리는 중입니다...');

    /* 한 장씩 차례로 (동시에 올리면 저장소가 충돌합니다) */
    return files.reduce(function (chain, file, i) {
      return chain.then(function () {
        say('(' + (done + 1) + '/' + files.length + ') ' + (file.name || '사진') + ' 처리 중...');

        return shrink(file).then(function (out) {
          var path = FOLDER + '/' + stamp() + '-' + (i + 1) + '.jpg';
          return push(path, out.base64, '[사진] ' + (file.name || path)).then(function () {
            added.push(path);
            done++;
            say('(' + done + '/' + files.length + ') 완료 · ' +
                Math.round(out.bytes / 1024) + 'KB 로 줄여서 올렸습니다');
          });
        }).catch(function (err) {
          failed++;
          say((file.name || '사진') + ' 실패: ' + err.message, '#e42939');
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
      if (failed) {
        say(added.length + '장 완료, ' + failed + '장 실패했습니다.', '#e42939');
      } else {
        say(added.length + '장 올렸습니다. 홈페이지에 반영되기까지 1~2분 걸립니다.', '#0059b9');
      }
    });
  }

  /* ---------- 연결 ---------- */
  function attach(fileInput, textarea, statusBox, options) {
    if (!textarea) return;
    var mode = (options && options.mode) || 'lines';

    /* 1. 버튼으로 고르기 */
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        handle(fileInput.files, textarea, statusBox, mode).then(function () {
          fileInput.value = '';
        });
      });
    }

    /* 2. 끌어다 놓기 */
    var baseOutline = textarea.style.outline;
    function highlight(on) {
      textarea.style.outline = on ? '2px dashed #0059b9' : baseOutline;
      textarea.style.outlineOffset = on ? '-4px' : '';
    }

    ['dragenter', 'dragover'].forEach(function (ev) {
      textarea.addEventListener(ev, function (e) {
        if (e.dataTransfer && e.dataTransfer.types &&
            Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') > -1) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          highlight(true);
        }
      });
    });

    ['dragleave', 'dragend'].forEach(function (ev) {
      textarea.addEventListener(ev, function () { highlight(false); });
    });

    textarea.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      highlight(false);
      handle(e.dataTransfer.files, textarea, statusBox, mode);
    });

    /* 3. 붙여넣기 (Ctrl+V) */
    textarea.addEventListener('paste', function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      var picked = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.indexOf('image/') === 0) {
          var f = items[i].getAsFile();
          if (f) picked.push(f);
        }
      }
      if (!picked.length) return;      // 글자 붙여넣기는 그대로 둡니다
      e.preventDefault();
      handle(picked, textarea, statusBox, mode);
    });
  }

  return { attach: attach, shrink: shrink, handle: handle };
})();

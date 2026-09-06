/* ============================================================
   초안 정리 도우미

   자동화 프로그램이 뽑아준 초안을 그대로 붙여넣으면
   AI가 읽기 어려운 글이 됩니다. 이 파일이 그걸 정리해 줍니다.

   1) 안내 문구 지우기
      "[카드뉴스 이미지 3] ... ← 여기에 이미지를 넣으세요" 같은 줄을 없앱니다.

   2) 소제목 만들기
      "📌 한국은행, 기준금리 3.00%로 인상 배경" 같은 줄을 <h2> 로 바꿉니다.
      AI는 <strong> 을 그냥 굵은 글씨로 보지만, <h2> 는 글의 뼈대로 읽습니다.

   3) 점검하기
      너무 긴 문단, 남아 있는 안내 문구, 짧은 본문을 등록 전에 알려 줍니다.
   ============================================================ */

window.DraftTidy = (function () {
  'use strict';

  /* 안내 문구가 들어 있는 줄인지 */
  function isPlaceholderLine(line) {
    var t = line.trim();
    if (!t) return false;
    if (/여기에\s*이미지를?\s*넣으세요/.test(t)) return true;
    if (/^[\s\W]*\[?(카드뉴스|본문)\s*(이미지|카드)\s*\d*\]?[\s\W]*$/.test(t)) return true;
    return false;
  }

  /* 소제목으로 바꿀 줄인지 - 📌 로 시작하는 줄 */
  function headingText(line) {
    var t = line.trim();
    if (!t) return null;

    // <strong>📌 제목</strong> 또는 📌 제목
    // (이모지는 글자 2칸을 차지하므로 [ ] 대신 (?: | ) 로 묶어야 반쪽만 잘리지 않습니다)
    var m = t.match(/^(?:<strong>|<b>)?\s*(?:📌|🔷|🔹|▶|■|◆|●|✅)\s*(.+?)\s*(?:<\/strong>|<\/b>)?$/);
    if (!m) return null;

    var text = m[1].replace(/<\/?(strong|b)>/g, '').trim();
    if (!text || text.length > 60) return null;   // 너무 길면 소제목이 아니라 문장
    return text;
  }

  /* ---------- 정리 ---------- */
  function tidy(raw) {
    var lines = String(raw || '').split(/\r?\n/);
    var out = [];
    var removed = 0, headings = 0;

    lines.forEach(function (line) {
      // 줄 안에 섞여 있는 안내 문구 조각 먼저 털어냅니다
      var cleaned = line
        .replace(/\[?\s*카드뉴스\s*이미지\s*\d*\s*\]?/g, ' ')
        .replace(/←\s*여기에\s*이미지를?\s*넣으세요/g, ' ')
        .replace(/[ \t]{2,}/g, ' ');

      if (isPlaceholderLine(line) || isPlaceholderLine(cleaned)) {
        removed++;
        return;
      }

      var h = headingText(cleaned);
      if (h) {
        out.push('<h2>' + h + '</h2>');
        headings++;
        return;
      }

      out.push(cleaned.replace(/\s+$/, ''));
    });

    // 빈 줄이 3개 이상 이어지면 2개로 줄입니다
    var text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();

    return { text: text, removed: removed, headings: headings };
  }

  /* ---------- 점검 ---------- */
  function check(raw) {
    var text = String(raw || '');
    var warn = [];

    if (!text.trim()) return warn;

    // 남아 있는 안내 문구
    var left = (text.match(/여기에\s*이미지를?\s*넣으세요/g) || []).length;
    if (left) warn.push({ level: 'bad', msg: '안내 문구가 ' + left + '군데 남아 있습니다. 정리 버튼을 눌러 주세요.' });

    // 소제목
    var h2 = (text.match(/<h2[\s>]/gi) || []).length;
    var plain = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    if (plain.length > 800 && h2 === 0) {
      warn.push({ level: 'warn', msg: '소제목(H2)이 없습니다. 긴 글은 소제목으로 나눠야 AI가 구조를 파악합니다.' });
    }

    // 긴 문단
    var paras = text.split(/\n[ \t]*\n+/).map(function (p) {
      return p.replace(/<[^>]*>/g, '').trim();
    }).filter(Boolean);

    var longOnes = [];
    paras.forEach(function (p, i) {
      var sentences = p.split(/[.!?。]\s/).filter(function (s) { return s.trim().length > 5; }).length;
      if (p.length > 400 || sentences > 6) longOnes.push(i + 1);
    });
    if (longOnes.length) {
      warn.push({
        level: 'warn',
        msg: longOnes.length + '개 문단이 너무 깁니다 (' + longOnes.slice(0, 5).join(', ') + '번째). ' +
             '한 문단은 3~4문장이 좋습니다.'
      });
    }

    // 너무 짧은 글
    if (plain.length < 300) {
      warn.push({ level: 'warn', msg: '본문이 ' + plain.length + '자로 짧습니다. AI가 인용하려면 충분한 설명이 필요합니다.' });
    }

    // 숫자가 없는 글
    if (!/\d/.test(plain)) {
      warn.push({ level: 'warn', msg: '구체적인 수치가 없습니다. 면적·층·가격·연도 같은 숫자를 넣으면 인용될 확률이 올라갑니다.' });
    }

    if (!warn.length) warn.push({ level: 'ok', msg: '점검 통과. 등록하셔도 좋습니다.' });
    return warn;
  }

  return { tidy: tidy, check: check };
})();

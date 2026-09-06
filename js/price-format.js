/* ============================================================
   가격 자동 변환

   숫자만 적어도 부동산에서 쓰는 표기로 바꿔 줍니다.

     70185       →  7억 185만원
     65000       →  6억 5,000만원
     3000        →  3,000만원
     30000       →  3억원
     750000000   →  7억 5,000만원   (1천만이 넘으면 '원' 단위로 봅니다)
     1000/50     →  보증금 1,000만원 / 월 50만원

   글자가 섞여 있으면(예: "6억 5,000만원", "가격 문의") 손대지 않고 그대로 둡니다.

   기본 단위는 '만원' 입니다.
   ============================================================ */

window.OceanPrice = (function () {
  'use strict';

  /* 원 단위로 보기 시작하는 기준 (1천만) */
  var WON_THRESHOLD = 10000000;

  function comma(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* 만원 단위 숫자를 '○억 ○,○○○만원' 으로 */
  function fromManwon(manwon) {
    manwon = Math.round(manwon);
    if (manwon <= 0) return '';

    var eok = Math.floor(manwon / 10000);
    var rest = manwon % 10000;

    if (eok && rest) return eok + '억 ' + comma(rest) + '만원';
    if (eok)         return eok + '억원';
    return comma(rest) + '만원';
  }

  /* 숫자 하나를 금액 표기로 (만원 기본, 큰 수는 원으로 판단) */
  function one(digits) {
    var n = parseInt(digits, 10);
    if (!isFinite(n) || n <= 0) return '';
    return fromManwon(n >= WON_THRESHOLD ? n / 10000 : n);
  }

  /* 숫자와 쉼표로만 이루어졌는지 */
  function isPlainNumber(text) {
    return /^[0-9,\s]+$/.test(text) && /[0-9]/.test(text);
  }

  function digitsOf(text) {
    return text.replace(/[^0-9]/g, '');
  }

  /* ---------- 바깥에서 쓰는 함수 ---------- */

  /* 입력값을 금액 표기로 바꿉니다. 바꿀 수 없으면 원래 글자를 그대로 돌려줍니다. */
  function format(raw) {
    var text = String(raw == null ? '' : raw).trim();
    if (!text) return '';

    /* 보증금/월세 (예: 1000/50) */
    var slash = text.split('/');
    if (slash.length === 2 && isPlainNumber(slash[0]) && isPlainNumber(slash[1])) {
      var deposit = one(digitsOf(slash[0]));
      var monthly = one(digitsOf(slash[1]));
      if (deposit && monthly) return '보증금 ' + deposit + ' / 월 ' + monthly;
      return text;
    }

    /* 숫자만 적었을 때 */
    if (isPlainNumber(text)) {
      return one(digitsOf(text)) || text;
    }

    /* 이미 글자가 섞여 있으면 그대로 둡니다 */
    return text;
  }

  /* 변환이 일어나는 입력인지 (미리보기를 보여줄지 판단할 때 씁니다) */
  function willChange(raw) {
    var text = String(raw == null ? '' : raw).trim();
    if (!text) return false;
    var out = format(text);
    return out !== text;
  }

  return { format: format, willChange: willChange, fromManwon: fromManwon };
})();

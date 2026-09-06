/* ============================================================
   게시글 개별 페이지 만들기 (GEO - 생성형 엔진 최적화)

   왜 필요한가요?
     지금 소식 목록은 브라우저가 자바스크립트로 그립니다.
     그런데 ChatGPT·Claude·Perplexity 같은 AI 크롤러는
     자바스크립트를 실행하지 않아서, 글이 하나도 없는 빈 화면을 봅니다.

     그래서 글을 등록할 때 글마다 HTML 파일을 하나씩 만들어 둡니다.
     그 파일에는 제목과 본문이 진짜 글자로 들어 있어서 AI가 읽을 수 있고,
     주소가 따로 생기기 때문에 AI가 인용할 수 있습니다.

   만들어지는 주소
     news/2026-09-06-주담대-금리-8-코앞.html

   쓰는 곳
     js/github-db.js 의 savePost() / deletePost() 가 자동으로 부릅니다.
   ============================================================ */

window.OceanGEO = (function () {
  'use strict';

  var SITE = 'https://oceanbudongsan.github.io';
  var DIR  = 'news';

  var INFO = {
    company: '강릉 오션 부동산',
    tel:     '010-9254-7988',
    telOffice: '033-652-7988'
  };

  /* 사이트맵에 항상 들어가는 고정 페이지 */
  var STATIC_PAGES = [
    ['index.html',           '1.0', 'weekly'],
    ['listings.html',        '0.9', 'daily'],
    ['news.html',            '0.9', 'daily'],
    ['property-submit.html', '0.7', 'monthly'],
    ['contact.html',         '0.6', 'monthly']
  ];

  /* ---------- 글자 다루기 ---------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* JSON-LD 안에 넣을 때 쓰는 문자열 (따옴표·줄바꿈 정리) */
  function jsonStr(s) {
    return JSON.stringify(String(s == null ? '' : s));
  }

  function stripTags(html) {
    return String(html || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ---------- 본문 문단 정리 (news.html 과 같은 규칙) ---------- */

  function formatBody(raw) {
    var text = String(raw || '').trim();
    if (!text) return '<p>내용이 없습니다.</p>';
    if (/<p[\s>]/i.test(text)) return text;   // 이미 문단 태그가 있는 글은 그대로

    var BLOCK = /^\s*<(img|ul|ol|h[1-6]|div|table|figure|blockquote|hr|pre|iframe)[\s>\/]/i;

    var blocks = text.split(/\n[ \t]*\n+/);
    if (blocks.length < 2) blocks = text.split(/\n+/);

    return blocks
      .map(function (b) { return b.trim(); })
      .filter(Boolean)
      .map(function (b) {
        return BLOCK.test(b) ? b : '<p>' + b.replace(/\n/g, '<br>') + '</p>';
      })
      .join('\n');
  }

  /* ---------- 주소 만들기 ---------- */

  /* 제목을 주소에 쓸 수 있는 형태로 (한글은 그대로 둡니다) */
  function slugify(title) {
    var s = String(title || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[^가-힣ㄱ-ㆎa-zA-Z0-9\s-]/g, ' ')  // 한글·영문·숫자만 남김
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');
    if (s.length > 50) s = s.slice(0, 50).replace(/-$/, '');
    return s || 'post';
  }

  /* 글의 날짜를 YYYY-MM-DD 로 */
  function dateStamp(post) {
    var d = null;
    if (post.createdAt) d = new Date(post.createdAt);
    if ((!d || isNaN(d.getTime())) && post.date) {
      d = new Date(String(post.date).replace(/\./g, '-'));
    }
    if (!d || isNaN(d.getTime())) d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ISO 형식 (구조화 데이터용) */
  function isoDate(value, fallback) {
    var d = value ? new Date(value) : null;
    if (!d || isNaN(d.getTime())) {
      d = fallback ? new Date(String(fallback).replace(/\./g, '-')) : new Date();
    }
    if (isNaN(d.getTime())) d = new Date();
    return d.toISOString();
  }

  function pagePath(post) {
    return DIR + '/' + dateStamp(post) + '-' + slugify(post.title) + '.html';
  }

  function pageUrl(post) {
    return SITE + '/' + pagePath(post).split('/').map(encodeURIComponent).join('/');
  }

  /* 본문 첫 사진 */
  function firstBodyImage(raw) {
    var m = String(raw || '').match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : '';
  }

  /* 상대 주소를 절대 주소로 (구조화 데이터에는 절대 주소가 필요합니다) */
  function absUrl(u) {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return SITE + '/' + String(u).replace(/^\.?\//, '');
  }

  function summaryOf(post) {
    var s = post.summary ? stripTags(post.summary) : stripTags(post.content);
    s = s.replace(/\.{3,}$/, '').trim();
    if (s.length > 155) s = s.slice(0, 152).trim() + '...';
    return s;
  }

  /* ---------- 구조화 데이터 ---------- */

  function articleLd(post) {
    var url   = pageUrl(post);
    var img   = absUrl(post.imageUrl || firstBodyImage(post.content));
    var pub   = isoDate(post.createdAt, post.date);
    var mod   = isoDate(post.updatedAt || post.createdAt, post.date);

    var lines = [
      '{',
      '  "@context": "https://schema.org",',
      '  "@type": "Article",',
      '  "headline": ' + jsonStr(stripTags(post.title)) + ',',
      '  "description": ' + jsonStr(summaryOf(post)) + ',',
      '  "articleSection": ' + jsonStr(post.category || '뉴스') + ',',
      '  "inLanguage": "ko-KR",',
      '  "datePublished": ' + jsonStr(pub) + ',',
      '  "dateModified": ' + jsonStr(mod) + ',',
      '  "mainEntityOfPage": { "@type": "WebPage", "@id": ' + jsonStr(url) + ' },',
      '  "url": ' + jsonStr(url) + ','
    ];
    if (img) lines.push('  "image": ' + jsonStr(img) + ',');
    lines.push(
      '  "author": { "@type": "Organization", "name": ' + jsonStr(INFO.company) + ', "url": "' + SITE + '/" },',
      '  "publisher": {',
      '    "@type": "RealEstateAgent",',
      '    "@id": "' + SITE + '/#organization",',
      '    "name": ' + jsonStr(INFO.company) + ',',
      '    "telephone": "+82-33-652-7988"',
      '  }',
      '}'
    );
    return lines.join('\n');
  }

  /* FAQ 글이면 질문/답변 구조로 내보냅니다 */
  function faqLd(post) {
    var answer = stripTags(formatBody(post.content));
    return [
      '{',
      '  "@context": "https://schema.org",',
      '  "@type": "FAQPage",',
      '  "inLanguage": "ko-KR",',
      '  "mainEntity": [{',
      '    "@type": "Question",',
      '    "name": ' + jsonStr(stripTags(post.title)) + ',',
      '    "acceptedAnswer": {',
      '      "@type": "Answer",',
      '      "text": ' + jsonStr(answer) + ',',
      '      "author": { "@type": "Organization", "name": ' + jsonStr(INFO.company) + ' }',
      '    }',
      '  }]',
      '}'
    ].join('\n');
  }

  function breadcrumbLd(post) {
    return [
      '{',
      '  "@context": "https://schema.org",',
      '  "@type": "BreadcrumbList",',
      '  "itemListElement": [',
      '    { "@type": "ListItem", "position": 1, "name": "홈", "item": "' + SITE + '/" },',
      '    { "@type": "ListItem", "position": 2, "name": "부동산소식", "item": "' + SITE + '/news.html" },',
      '    { "@type": "ListItem", "position": 3, "name": ' + jsonStr(stripTags(post.title)) + ' }',
      '  ]',
      '}'
    ].join('\n');
  }

  /* ---------- 페이지 틀 ---------- */

  var TAILWIND_CONFIG = [
    '<script>',
    'tailwind.config = { darkMode: "class", theme: { extend: {',
    '  colors: {',
    '    "canvas": "#f2f4f6", "card": "#ffffff", "background": "#f9f9ff",',
    '    "primary": "#0059b9", "secondary": "#0056c6", "on-primary": "#ffffff",',
    '    "on-surface": "#181c23", "on-surface-variant": "#414754", "body-text": "#4e5968",',
    '    "surface-variant": "#e0e2ec", "surface-container": "#ecedf7", "sub-blue-bg": "#e8f3ff",',
    '    "surface-bright": "#f9f9ff"',
    '  },',
    '  borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },',
    '  spacing: { "padding-container": "20px", "stack-md": "16px", "stack-lg": "24px" },',
    '  fontFamily: {',
    '    "headline-lg": ["Plus Jakarta Sans","sans-serif"], "headline-md": ["Plus Jakarta Sans","sans-serif"],',
    '    "label-sm": ["Plus Jakarta Sans","sans-serif"], "label-md": ["Plus Jakarta Sans","sans-serif"],',
    '    "body-md": ["Plus Jakarta Sans","sans-serif"]',
    '  },',
    '  fontSize: {',
    '    "headline-lg": ["28px", { lineHeight: "1.3", fontWeight: "700" }],',
    '    "headline-md": ["22px", { lineHeight: "1.4", fontWeight: "600" }],',
    '    "label-sm": ["12px", { lineHeight: "1", fontWeight: "700" }],',
    '    "label-md": ["15px", { lineHeight: "1.2", fontWeight: "600" }],',
    '    "body-md": ["16px", { lineHeight: "1.6", fontWeight: "400" }]',
    '  }',
    '} } }',
    '<\/script>'
  ].join('\n');

  function buildPostHtml(post) {
    var url      = pageUrl(post);
    var title    = stripTags(post.title);
    var desc     = summaryOf(post);
    var body     = formatBody(post.content);
    var cover    = post.imageUrl || '';
    var inBody   = cover && cover === firstBodyImage(post.content);
    var category = post.category || '뉴스';
    var isFaq    = category === 'FAQ' || category === '자주묻는질문';
    var pub      = isoDate(post.createdAt, post.date);
    var img      = absUrl(cover || firstBodyImage(post.content));

    var coverHtml = (cover && !inBody)
      ? '<figure class="w-full rounded-2xl overflow-hidden mb-8 bg-gray-100">' +
        '<img src="' + esc(cover) + '" alt="' + esc(title) + '" class="w-full h-auto block">' +
        '</figure>'
      : '';

    return [
      '<!DOCTYPE html>',
      '<html lang="ko">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '<base href="../">',
      '<title>오션부동산 - ' + esc(title) + '</title>',
      '<meta name="description" content="' + esc(desc) + '">',
      '<link rel="canonical" href="' + esc(url) + '">',
      '<meta property="og:type" content="article">',
      '<meta property="og:site_name" content="' + INFO.company + '">',
      '<meta property="og:title" content="' + esc(title) + '">',
      '<meta property="og:description" content="' + esc(desc) + '">',
      '<meta property="og:url" content="' + esc(url) + '">',
      '<meta property="og:locale" content="ko_KR">',
      img ? '<meta property="og:image" content="' + esc(img) + '">' : '',
      '<meta property="article:published_time" content="' + esc(pub) + '">',
      '<meta property="article:section" content="' + esc(category) + '">',
      '',
      '<script type="application/ld+json">',
      isFaq ? faqLd(post) : articleLd(post),
      '<\/script>',
      '<script type="application/ld+json">',
      breadcrumbLd(post),
      '<\/script>',
      '',
      '<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"><\/script>',
      TAILWIND_CONFIG,
      '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">',
      '<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">',
      '<link href="css/ocean-motion.css?v=20260906e" rel="stylesheet">',
      '<link rel="stylesheet" href="common.css?v=20260906e">',
      '<style>',
      '  body { font-family: "Plus Jakarta Sans", sans-serif; }',
      '  .oc-article p { margin: 0 0 1.1em; }',
      '  .oc-article h2 { font-size: 20px; font-weight: 700; color: #181c23; margin: 2em 0 .7em; }',
      '  .oc-article h3 { font-size: 17px; font-weight: 700; color: #181c23; margin: 1.6em 0 .6em; }',
      '  .oc-article ul, .oc-article ol { margin: 0 0 1.1em 1.2em; list-style: disc; }',
      '  .oc-article li { margin: .3em 0; }',
      '  .oc-article img { max-width: 100%; height: auto; border-radius: 12px; margin: 1.4em 0; display: block; }',
      '  .oc-article strong { color: #181c23; }',
      '</style>',
      '</head>',
      '<body class="bg-canvas text-on-surface antialiased min-h-screen flex flex-col pt-16">',
      '',
      '<main class="flex-grow w-full max-w-3xl mx-auto px-padding-container py-stack-lg">',
      '',
      '  <nav aria-label="현재 위치" class="text-xs text-gray-500 mb-4">',
      '    <a href="index.html" class="hover:text-primary">홈</a>',
      '    <span class="mx-1">›</span>',
      '    <a href="news.html" class="hover:text-primary">부동산소식</a>',
      '  </nav>',
      '',
      '  <article class="bg-card rounded-2xl p-6 md:p-10 shadow-sm border border-gray-100">',
      '    <div class="flex items-center gap-2 mb-3">',
      '      <span class="px-3 py-1 bg-sub-blue-bg text-secondary text-xs font-bold rounded-lg">' + esc(category) + '</span>',
      '      <time datetime="' + esc(pub.slice(0, 10)) + '" class="text-xs text-gray-400">' + esc(post.date || '') + '</time>',
      '      <span class="text-xs text-gray-400">· ' + esc(post.author || INFO.company) + '</span>',
      '    </div>',
      '',
      '    <h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6 leading-snug">' + esc(title) + '</h1>',
      '',
      '    ' + coverHtml,
      '',
      '    <div class="oc-article max-w-none text-gray-700 font-body-md leading-relaxed">',
      body,
      '    </div>',
      '',
      '    <div class="mt-10 pt-6 border-t border-gray-100 text-xs text-gray-400">',
      '      이 글은 ' + INFO.company + '이 직접 작성했습니다. 인용하실 때는 출처와 작성일을 함께 표기해 주세요.',
      '    </div>',
      '  </article>',
      '',
      '  <div class="mt-6 flex justify-center">',
      '    <a href="news.html" class="px-6 py-3 rounded-xl bg-card border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">목록으로</a>',
      '  </div>',
      '</main>',
      '',
      '<div class="w-full bg-primary py-12 px-padding-container mt-12">',
      '  <div class="max-w-4xl mx-auto text-center flex flex-col items-center gap-6">',
      '    <h2 class="font-headline-md text-headline-md text-on-primary font-bold">강릉 부동산, 궁금한 점이 있으신가요?</h2>',
      '    <p class="font-body-md text-body-md text-on-primary opacity-90">' + INFO.company + ' 전문가가 친절하게 상담해 드립니다.</p>',
      '    <div class="flex flex-wrap justify-center gap-4 mt-4 w-full md:w-auto">',
      '      <a href="tel:' + INFO.tel + '" class="w-full md:w-auto px-8 py-4 bg-white text-primary rounded-lg text-sm font-bold hover:bg-surface-bright transition-colors flex items-center justify-center gap-2 h-[56px]">전화 연결</a>',
      '      <a href="property-submit.html" class="w-full md:w-auto px-8 py-4 bg-white text-primary rounded-lg text-sm font-bold hover:bg-surface-bright transition-colors flex items-center justify-center gap-2 h-[56px]">매물 접수</a>',
      '    </div>',
      '  </div>',
      '</div>',
      '',
      '<script src="common.js?v=20260906e" data-bottomnav="off"><\/script>',
      '</body>',
      '</html>',
      ''
    ].filter(function (l) { return l !== ''; }).join('\n');
  }

  /* ---------- 사이트맵 ---------- */

  function buildSitemap(posts) {
    var today = new Date().toISOString().slice(0, 10);
    var out = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];

    STATIC_PAGES.forEach(function (row) {
      out.push('  <url>',
               '    <loc>' + SITE + '/' + row[0] + '</loc>',
               '    <lastmod>' + today + '</lastmod>',
               '    <changefreq>' + row[2] + '</changefreq>',
               '    <priority>' + row[1] + '</priority>',
               '  </url>');
    });

    (posts || []).forEach(function (p) {
      if (!p || !p.pagePath) return;   // 개별 페이지가 있는 글만
      var mod = isoDate(p.updatedAt || p.createdAt, p.date).slice(0, 10);
      out.push('  <url>',
               '    <loc>' + SITE + '/' + p.pagePath.split('/').map(encodeURIComponent).join('/') + '</loc>',
               '    <lastmod>' + mod + '</lastmod>',
               '    <changefreq>monthly</changefreq>',
               '    <priority>0.8</priority>',
               '  </url>');
    });

    out.push('</urlset>', '');
    return out.join('\n');
  }

  return {
    site: SITE,
    slugify: slugify,
    formatBody: formatBody,
    firstBodyImage: firstBodyImage,
    pagePath: pagePath,
    pageUrl: pageUrl,
    buildPostHtml: buildPostHtml,
    buildSitemap: buildSitemap,
    stripTags: stripTags
  };
})();

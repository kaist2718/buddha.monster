// 정적 페이지 생성기 — data/verses-en.json + data/ko-*.js + data/chapters.js 를 합쳐
// chapters/*.html 정적 페이지와 목차·검색용 데이터를 만듭니다.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── 데이터 로드 ─────────────────────────────────────────────
const en = JSON.parse(readFileSync(join(root, 'data/verses-en.json'), 'utf8'));
const pali = JSON.parse(readFileSync(join(root, 'data/verses-pali.json'), 'utf8')).verses;

const ko = {};
for (const f of readdirSync(join(root, 'data')).filter((f) => /^ko-\d\.js$/.test(f)).sort()) {
  const mod = require(join(root, 'data', f));
  Object.assign(ko, mod);
}
const chapters = require(join(root, 'data', 'chapters.js'));

// ── 검증 ───────────────────────────────────────────────────
let missing = [];
let count = 0;
for (const ch of en.chapters) {
  for (const v of ch.verses) {
    count++;
    if (ko[v.n] === undefined) missing.push(v.n);
    for (let n = v.n; n <= (v.nEnd || v.n); n++) {
      if (pali[n] === undefined) missing.push(`팔리어 ${n}`);
    }
  }
}
console.log(`게송 단락: ${count} / 우리말 번역: ${Object.keys(ko).length}`);
if (missing.length) {
  console.error('우리말 누락:', missing.join(', '));
  process.exit(1);
}
if (en.chapters.length !== 26 || chapters.length !== 26) {
  console.error('품 수 오류');
  process.exit(1);
}

// ── 템플릿 ─────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page({ title, desc, canonical, body, extraHead = '', depth = 0 }) {
  const p = depth ? '../' : '';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#2b2118">
<link rel="canonical" href="https://buddha.monster/${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="마음의 괴물을 다스리는 부처님">
<meta property="og:image" content="https://buddha.monster/og.png">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="https://buddha.monster/${canonical}">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${p}icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${p}apple-touch-icon.png">
<link rel="manifest" href="${p}manifest.webmanifest">
<link rel="stylesheet" href="${p}assets/site.css">
${extraHead}
</head>
<body>
<a class="skip-link" href="#main">본문으로 바로가기</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="logo" href="${p}index.html"><span class="logo-mark" aria-hidden="true">法</span><span class="logo-text">마음의 괴물을 다스리는 <span class="accent">부처님</span></span></a>
    <nav class="nav" id="nav" aria-label="주요 메뉴">
      <a href="${p}index.html">홈</a>
      <a href="${p}index.html#toc">목차</a>
      <a href="${p}sources.html">영어 원문 자료실</a>
      <a href="${p}glossary.html">용어 사전</a>
      <a href="${p}plan.html">독송 플랜</a>
      <a href="${p}about.html">이 책에 대하여</a>
    </nav>
    <div class="theme-set" role="group" data-i18n-aria-label="테마 선택">
      <button class="theme-opt" type="button" data-theme-option="light" aria-pressed="false" aria-label="라이트 모드로 보기" title="라이트">☀️</button>
      <button class="theme-opt" type="button" data-theme-option="dark" aria-pressed="false" aria-label="다크 모드로 보기" title="다크">🌙</button>
      <button class="theme-opt" type="button" data-theme-option="system" aria-pressed="true" aria-label="시스템 설정 따르기" title="시스템">🖥️</button>
    </div>
    <button class="menu-btn" id="menuBtn" type="button" aria-label="메뉴" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p class="foot-title">마음의 괴물을 다스리는 부처님 — 법구경(Dhammapada) 영어·한국어 대역</p>
    <p class="foot-note">영어 원문: F. Max Müller 번역(1881, 공중도메인) · 우리말 번역·해설: 자체 편찬<br>
    본 사이트는 법구경 학습을 돕기 위한 무료 사이트입니다.</p>
    <p class="foot-links"><a href="${p}index.html">홈</a> · <a href="${p}sources.html">영어 원문 자료실</a> · <a href="${p}glossary.html">용어 사전</a> · <a href="${p}plan.html">독송 플랜</a> · <a href="${p}about.html">이 책에 대하여</a> · <a href="${p}privacy.html">개인정보처리방침</a> · <a href="${p}terms.html">이용약관</a></p>
  </div>
</footer>
<script src="${p}assets/app.js"></script>
</body>
</html>
`;
}

// ── 챕터 페이지 생성 ────────────────────────────────────────
const outDir = join(root, 'chapters');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const ch of en.chapters) {
  const meta = chapters.find((c) => c.num === ch.num);
  const versesHtml = ch.verses
    .map((v) => {
      const numLabel = v.nEnd && v.nEnd !== v.n ? `${v.n}–${v.nEnd}` : String(v.n);
      // 병합 게송(예: 58–59)은 팔리어를 줄 단위로 이어 붙입니다.
      const paliLines = [];
      for (let n = v.n; n <= (v.nEnd || v.n); n++) if (pali[n]) paliLines.push(pali[n]);
      return `
<article class="verse" id="v${v.n}" data-verse="${v.n}">
  <div class="verse-head">
    <span class="verse-num">${numLabel}</span>
    <button class="tts-btn" type="button" data-tts aria-label="영어 낭독 듣기">듣기</button>
    <button class="copy-btn" type="button" data-copy aria-label="게송 인용 복사">인용 복사</button>
  </div>
  <p class="verse-pali" lang="pi">${esc(paliLines.join(' '))}</p>
  <p class="verse-en" lang="en">${esc(v.en)}</p>
  <p class="verse-ko">${esc(ko[v.n])}</p>
</article>`;
    })
    .join('\n');

  const prev = chapters.find((c) => c.num === ch.num - 1);
  const next = chapters.find((c) => c.num === ch.num + 1);

  const body = `
<nav class="crumbs wrap" aria-label="위치"><a href="../index.html">홈</a> <span>/</span> <a href="../index.html#toc">법구경 26품</a> <span>/</span> <span>제${ch.num}품</span></nav>
<article class="chapter wrap">
  <header class="chapter-head">
    <p class="chapter-kicker">제${ch.num}품 · Chapter ${ch.num}</p>
    <h1>${esc(meta.koFull)}</h1>
    <p class="chapter-sub"><span lang="en">${esc(meta.en)}</span> · <span class="pali">${esc(meta.pali)}</span> · 게송 ${meta.from}–${meta.to}</p>
    <p class="chapter-theme">이 품의 주제 — ${esc(meta.theme.ko)} <span lang="en">/ ${esc(meta.theme.en)}</span></p>
    <div class="chapter-intro">
      <p>${esc(meta.intro.ko)}</p>
      <p class="intro-en" lang="en">${esc(meta.intro.en)}</p>
    </div>
    <div class="practice"><p class="practice-label">마음 다스리기</p><p>${esc(meta.practice.ko)}</p><p class="practice-en" lang="en">${esc(meta.practice.en)}</p></div>
    <div class="chapter-tools">
      <button class="btn btn-ghost" type="button" data-tts-all>이 품 영어 낭독</button>
      <button class="btn btn-ghost" type="button" data-ko-toggle>우리말 가리기</button>
      <button class="btn btn-ghost" type="button" data-pali-toggle aria-pressed="true">팔리어 가리기</button>
      <button class="btn btn-ghost" type="button" onclick="window.print()">인쇄 · PDF</button>
    </div>
  </header>
  <section class="verses" aria-label="게송 본문">
${versesHtml}
  </section>
  <nav class="chapter-nav" aria-label="이전/다음 품">
    ${prev ? `<a class="btn btn-ghost" href="${String(prev.num).padStart(2, '0')}.html">← 제${prev.num}품 ${esc(prev.ko)}</a>` : '<span></span>'}
    <a class="btn btn-primary" href="../index.html#toc">목차</a>
    ${next ? `<a class="btn btn-ghost" href="${String(next.num).padStart(2, '0')}.html">제${next.num}품 ${esc(next.ko)} →</a>` : '<span></span>'}
  </nav>
</article>`;

  // 구조화 데이터 — 검색엔진용 (Book + Chapter)
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: `법구경 제${ch.num}품 ${meta.koFull}`,
    alternateName: meta.en,
    inLanguage: ['ko', 'en', 'pi'],
    isPartOf: {
      '@type': 'Book',
      name: '마음의 괴물을 다스리는 부처님 — 법구경(Dhammapada) 영어·한국어 대역',
      url: 'https://buddha.monster/',
    },
    description: `법구경 제${ch.num}품 ${meta.koFull}(${meta.pali}). 게송 ${meta.from}–${meta.to} 팔리어 원문·영어 원문·우리말 번역, 품별 해설과 마음 다스리기 실천.`,
    url: `https://buddha.monster/chapters/${String(ch.num).padStart(2, '0')}.html`,
  };
  const extraHead = `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`;

  writeFileSync(
    join(outDir, `${String(ch.num).padStart(2, '0')}.html`),
    page({
      title: `제${ch.num}품 ${meta.koFull} — ${meta.en} | 법구경 ${meta.from}–${meta.to} | 마음의 괴물을 다스리는 부처님`,
      desc: `법구경 제${ch.num}품 ${meta.koFull}(${meta.pali}). 게송 ${meta.from}–${meta.to} 팔리어 원문·영어 원문·우리말 번역, 품별 해설과 마음 다스리기 실천까지 담았습니다.`,
      canonical: `chapters/${String(ch.num).padStart(2, '0')}.html`,
      body,
      extraHead,
      depth: 1,
    })
  );
}
console.log('chapters/ 26개 페이지 생성 완료');

// ── 챕터 목차 데이터(홈 검색용) ─────────────────────────────
const index = en.chapters.map((ch) => {
  const meta = chapters.find((c) => c.num === ch.num);
  return {
    num: ch.num,
    ko: meta.koFull,
    en: meta.en,
    pali: meta.pali,
    from: meta.from,
    to: meta.to,
    theme: meta.theme,
    verses: ch.verses.map((v) => {
      const paliLines = [];
      for (let n = v.n; n <= (v.nEnd || v.n); n++) if (pali[n]) paliLines.push(pali[n]);
      return { n: v.n, nEnd: v.nEnd || v.n, en: v.en, ko: ko[v.n], pali: paliLines.join(' ') };
    }),
  };
});
writeFileSync(join(root, 'data', 'search-index.js'),
  '// 빌드 산출물 — 홈 검색·오늘의 법구용 데이터 (tools/build-pages.mjs 로 재생성)\n' +
  '(function (root, data) {\n  if (typeof module === \'object\' && module.exports) module.exports = data;\n  else root.DHP_INDEX = data;\n})(typeof globalThis !== \'undefined\' ? globalThis : this, ' +
  JSON.stringify(index) + ');\n');
console.log('data/search-index.js 생성 완료');

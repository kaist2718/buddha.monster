#!/usr/bin/env node
/**
 * sitemap.xml · feed.xml 생성 — 검색엔진에 알릴 공개 페이지 전체를 자동으로 모읍니다.
 *
 * · 룰: robots noindex 페이지(개인정보처리방침·이용약관·404)는 sitemap 에 넣지 않습니다.
 *   (noindex 와 sitemap 은 서로 어긋나므로 검색엔진이 제외한 페이지를 알리지 않습니다)
 * · lastmod: git 이 알고 있는 마지막 수정일을 씁니다. 아직 커밋하지 않은 수정이 있는
 *   파일은 오늘 날짜를 넣어, 재생성해도 값이 흔들리지 않게 합니다.
 * · feed.xml: 네이버 서치어드바이저 RSS 제출용 — RSS 2.0, 품별 아이템 26개.
 *   pubDate 는 sitemap lastmod 와 같은 기준이라 재생성해도 값이 흔들리지 않습니다.
 *
 * 실행: node tools/build-sitemap.mjs  (npm run build 에 포함)
 */
import { execSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://buddha.monster';

/** 검색엔진에 알릴 루트 페이지 — 새 페이지를 만들면 여기에도 넣어야 sitemap 에 들어갑니다. */
const ROOT_PAGES = [
  { file: 'index.html', priority: '1.0' },
  { file: 'sources.html', priority: '0.7' },
  { file: 'glossary.html', priority: '0.7' },
  { file: 'plan.html', priority: '0.7' },
  { file: 'about.html', priority: '0.7' },
];

// 현지 날짜 — git 의 %cs(커밋 날짜)와 같은 기준이어야 재생성해도 값이 흔들리지 않습니다
const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

function lastmod(file) {
  try {
    const status = execSync(`git status --porcelain -- "${file}"`, { cwd: ROOT, encoding: 'utf8' }).trim();
    if (status) return today(); // 커밋 전 수정분 — 오늘 날짜로 고정
    const d = execSync(`git log -1 --format=%cs -- "${file}"`, { cwd: ROOT, encoding: 'utf8' }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  } catch { /* git 이 없는 환경이면 오늘 날짜로 */ }
  return today();
}

const chapterPages = readdirSync(join(ROOT, 'chapters'))
  .filter((f) => /^\d{2}\.html$/.test(f))
  .sort()
  .map((f) => ({ file: `chapters/${f}`, priority: '0.9' }));

const pages = [...ROOT_PAGES, ...chapterPages];

const urls = pages.map(({ file, priority }) => {
  const loc = file === 'index.html' ? `${SITE}/` : `${SITE}/${file}`;
  return `  <url><loc>${loc}</loc><lastmod>${lastmod(file)}</lastmod><priority>${priority}</priority></url>`;
});

writeFileSync(
  join(ROOT, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join('\n') + '\n</urlset>\n'
);
console.log(`sitemap.xml 생성 완료 — ${pages.length}개 URL (lastmod 포함)`);

// ── feed.xml — 네이버 서치어드바이저 RSS 제출용 (RSS 2.0 · 품별 아이템 26개) ──
const chapterMeta = require(join(ROOT, 'data', 'chapters.js'));
const escXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 'YYYY-MM-DD' → RFC 822 (예: Tue, 29 Sep 2026 00:00:00 +0900) */
function rfc822(date) {
  const [y, m, d] = date.split('-').map(Number);
  const dow = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow}, ${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y} 00:00:00 +0900`;
}

const feedItems = chapterPages.map(({ file }) => {
  const num = Number(file.match(/\d+/)[0]);
  const meta = chapterMeta.find((c) => c.num === num);
  const url = `${SITE}/${file}`;
  return [
    '    <item>',
    `      <title>${escXml(`제${num}품 ${meta.koFull} — ${meta.en}`)}</title>`,
    `      <link>${url}</link>`,
    `      <guid isPermaLink="true">${url}</guid>`,
    `      <description>${escXml(`제${num}품 ${meta.koFull}(${meta.pali}) · 게송 ${meta.from}–${meta.to} — ${meta.intro.ko}`)}</description>`,
    `      <pubDate>${rfc822(lastmod(file))}</pubDate>`,
    '    </item>',
  ].join('\n');
});

writeFileSync(
  join(ROOT, 'feed.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '  <channel>\n' +
    '    <title>마음의 괴물을 다스리는 부처님 — 법구경 영어·한국어 대역</title>\n' +
    `    <link>${SITE}/</link>\n` +
    '    <description>법구경(Dhammapada) 26품 423게송을 팔리어 원문·영어 원문·우리말 번역으로 담은 무료 대역본. 품별 해설과 마음 다스리기 실천까지.</description>\n' +
    '    <language>ko</language>\n' +
    `    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>\n` +
    `    <lastBuildDate>${rfc822(lastmod('index.html'))}</lastBuildDate>\n` +
    feedItems.join('\n') +
    '\n  </channel>\n</rss>\n'
);
console.log(`feed.xml 생성 완료 — RSS 2.0 · 품별 아이템 ${feedItems.length}개`);

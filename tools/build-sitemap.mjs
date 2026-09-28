#!/usr/bin/env node
/**
 * sitemap.xml 생성 — 검색엔진에 알릴 공개 페이지 전체를 자동으로 모읍니다.
 *
 * · 룰: robots noindex 페이지(개인정보처리방침·이용약관·404)는 sitemap 에 넣지 않습니다.
 *   (noindex 와 sitemap 은 서로 어긋나므로 검색엔진이 제외한 페이지를 알리지 않습니다)
 * · lastmod: git 이 알고 있는 마지막 수정일을 씁니다. 아직 커밋하지 않은 수정이 있는
 *   파일은 오늘 날짜를 넣어, 재생성해도 값이 흔들리지 않게 합니다.
 *
 * 실행: node tools/build-sitemap.mjs  (npm run build 에 포함)
 */
import { execSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

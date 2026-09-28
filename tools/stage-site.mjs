#!/usr/bin/env node
/**
 * 배포용 사이트 폴더(_site) 구성 — 공개할 파일만 골라 담습니다.
 *
 * 이 저장소는 사이트 파일과 운영 도구(tools/ · .github/ 등)가 한 루트에 섞여 있습니다.
 * main 브랜치를 그대로 배포하면 운영 도구까지 인터넷에 공개되므로,
 * 배포 전에 공개 목록에 있는 파일만 _site 로 복사하고 빠진 것이 없는지 검증합니다.
 *
 * 검사:
 *   ① 공개 파일·폴더가 실제로 있는가
 *   ② sitemap.xml 의 모든 URL 이 _site 안에 실제 파일로 존재하는가
 *   ③ _site 안의 HTML 이 부르는 로컬 자산이 모두 있는가
 *   ④ 운영 경로(tools/ · .github/ · data/ 원본 등)가 섞이지 않았는가
 *
 * 실행:  node tools/stage-site.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const SITE = 'https://buddha.monster';

/** 사이트로 그대로 배포하는 루트 파일. 새 파일을 만들면 여기에도 넣어야 배포됩니다. */
const PUBLIC_FILES = [
  'index.html',
  'sources.html',
  'about.html',
  '404.html',
  'glossary.html',
  'plan.html',
  'privacy.html',
  'terms.html',
  'robots.txt',
  'sitemap.xml',
  'CNAME',
  'manifest.webmanifest',
  'sw.js',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'og.png',
];

/** 사이트로 그대로 배포하는 폴더. */
const PUBLIC_DIRS = ['chapters', 'assets', 'data'];

/** 배포본에 있으면 안 되는 운영 경로. */
const FORBIDDEN = ['tools', '.github', '.cache', '_source', 'node_modules', 'docs', '.git'];

let errors = 0;
const fail = (m) => { console.error('✗ ' + m); errors++; };

// 1) _site 재구성
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const f of PUBLIC_FILES) {
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) { fail(`공개 파일 없음: ${f}`); continue; }
  fs.copyFileSync(src, path.join(OUT, f));
}
for (const d of PUBLIC_DIRS) {
  const src = path.join(ROOT, d);
  if (!fs.existsSync(src)) { fail(`공개 폴더 없음: ${d}`); continue; }
  fs.cpSync(src, path.join(OUT, d), { recursive: true });
}

// 2) sitemap ↔ 파일 대조
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const rel = m[1].replace(SITE, '').replace(/^\//, '') || 'index.html';
  if (!fs.existsSync(path.join(OUT, rel))) fail(`sitemap URL 에 파일 없음: ${rel}`);
}

// 3) HTML 의 로컬 자산 확인
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
for (const file of walk(OUT).filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|data:|#)/.test(ref)) continue;
    const target = path.resolve(path.dirname(file), ref.split('#')[0]);
    if (!fs.existsSync(target)) fail(`자산 없음: ${path.relative(OUT, file)} → ${ref}`);
  }
}

// 4) 운영 경로 침투 확인
for (const f of walk(OUT)) {
  const rel = path.relative(OUT, f).replace(/\\/g, '/');
  if (FORBIDDEN.some((bad) => rel === bad || rel.startsWith(bad + '/'))) {
    fail(`운영 파일이 배포본에 섞임: ${rel}`);
  }
}

const count = walk(OUT).length;
if (errors) { console.error(`\n${errors}개 문제 — 배포본을 수정하세요`); process.exit(1); }
console.log(`✓ _site 구성 완료 (${count}개 파일) — 공개 목록만 담겼습니다`);

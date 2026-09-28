#!/usr/bin/env node
// 사이트가 실제로 화면에 내보내는 글자 집합 — 폰트 서브셋의 입력.
// 실행: node tools/font-charset.mjs --out .cache/charset.txt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 화면에 글자가 나오는 파일들 (새 콘텐츠 파일을 추가하면 여기에도 넣어야 합니다)
const FILES = [
  'index.html',
  'sources.html',
  'about.html',
  'glossary.html',
  'plan.html',
  'privacy.html',
  'terms.html',
  '404.html',
  'assets/site.css',
  'assets/app.js',
  'data/search-index.js',
  'data/chapters.js',
];

export function collectCharset(root = ROOT) {
  const files = FILES.filter((f) => fs.existsSync(path.join(root, f)));
  // chapters/ 정적 페이지까지 포함
  const chapterDir = path.join(root, 'chapters');
  const extra = fs.existsSync(chapterDir)
    ? fs.readdirSync(chapterDir).filter((f) => f.endsWith('.html')).map((f) => `chapters/${f}`)
    : [];
  const set = new Set();
  for (const rel of [...files, ...extra]) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const ch of text) set.add(ch.codePointAt(0));
  }
  return { codepoints: [...set].sort((a, b) => a - b), files: [...files, ...extra] };
}

export function toUnicodeFile(codepoints) {
  return codepoints.map((c) => c.toString(16)).join(',') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { codepoints, files } = collectCharset();
  const outAt = process.argv.indexOf('--out');
  if (outAt >= 0 && process.argv[outAt + 1]) {
    const out = path.resolve(ROOT, process.argv[outAt + 1]);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, toUnicodeFile(codepoints));
    console.log(`→ ${path.relative(ROOT, out)} (${codepoints.length}자)`);
  }
  const hangul = codepoints.filter((c) => c >= 0xac00 && c <= 0xd7a3).length;
  console.log(`사이트 글자 ${codepoints.length}자 (한글 음절 ${hangul}자) · 파일 ${files.length}개에서 수집`);
}

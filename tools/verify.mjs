// 사이트 검증 — 게송 수·번역 누락·내부 링크·페이지 구조를 확인합니다.
// 실행: node tools/verify.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
const fail = (msg) => { console.error('✗ ' + msg); errors++; };
const ok = (msg) => console.log('✓ ' + msg);

// 1) 게송 수 검증 (423개 번호 커버)
const en = JSON.parse(readFileSync(join(root, 'data/verses-en.json'), 'utf8'));
const ko = {};
for (const f of readdirSync(join(root, 'data')).filter((f) => /^ko-\d\.js$/.test(f))) {
  Object.assign(ko, require(join(root, 'data', f)));
}
const nums = new Set();
for (const ch of en.chapters) for (const v of ch.verses) {
  for (let n = v.n; n <= (v.nEnd || v.n); n++) nums.add(n);
  if (ko[v.n] === undefined) fail(`우리말 번역 누락: ${v.n}게송`);
}
if (nums.size === 423) ok('게송 423개 번호 전체 커버');
else fail(`게송 번호 ${nums.size}개 — 423이어야 합니다`);

// 2) 챕터 페이지 검증
const chaptersDir = join(root, 'chapters');
const pages = readdirSync(chaptersDir).filter((f) => f.endsWith('.html'));
if (pages.length === 26) ok('chapters/ 26개 페이지');
else fail(`chapters/ 페이지 ${pages.length}개 — 26이어야 합니다`);

let verseEls = 0;
const links = new Set();
for (const p of pages) {
  const html = readFileSync(join(chaptersDir, p), 'utf8');
  const m = html.match(/class="verse"/g);
  if (m) verseEls += m.length;
  if (!html.includes('<h1>')) fail(`${p}: h1 없음`);
  if (!html.includes('id="trainStrip"')) fail(`${p}: 마음 단련 스트립(#trainStrip) 없음`);
  if (!html.includes('assets/train.js')) fail(`${p}: assets/train.js 미포함`);
  for (const l of html.matchAll(/href="([^"#][^"]*)"/g)) links.add(l[1]);
}
if (verseEls === 414) ok(`챕터 페이지 게송 요소 414개(병합 게송 포함) — 실제: ${verseEls}`);
else fail(`게송 요소 ${verseEls}개 — 414여야 합니다`);

// 3) 내부 링크 검증
for (const l of links) {
  if (/^(https?:|mailto:)/.test(l)) continue;
  const target = l.replace(/^\.\.\//, '').split('#')[0];
  if (!target) continue;
  const base = l.startsWith('../') ? root : chaptersDir;
  const path = join(l.startsWith('../') ? root : chaptersDir, l.replace(/^\.\.\//, '').split('#')[0]);
  if (!existsSync(path)) fail(`깨진 링크: ${l}`);
}
ok(`내부 링크 ${links.size}개 확인`);

// 4) 홈·자료실·소개 페이지 구조
for (const p of ['index.html', 'sources.html', 'about.html', 'glossary.html', 'plan.html', 'privacy.html', 'terms.html', 'manifest.webmanifest', 'sw.js', 'assets/site.css', 'assets/app.js', 'assets/train.js', 'icon.svg']) {
  if (!existsSync(join(root, p))) fail(`파일 없음: ${p}`);
}
// 정적 페이지의 내부 링크 확인
for (const p of ['index.html', 'sources.html', 'about.html', 'glossary.html', 'plan.html', 'privacy.html', 'terms.html', '404.html']) {
  const html = readFileSync(join(root, p), 'utf8');
  for (const l of html.matchAll(/href="([^"#][^"]*)"/g)) {
    const ref = l[1];
    if (/^(https?:|mailto:)/.test(ref)) continue;
    const target = join(root, ref.split('#')[0]);
    if (!existsSync(target)) fail(`${p}: 깨진 링크 ${ref}`);
  }
}
const home = readFileSync(join(root, 'index.html'), 'utf8');
for (const id of ['toc', 'search', 'dailyVerse', 'training', 'trainPanel', 'trainMini']) {
  if (!home.includes(`id="${id}"`)) fail(`index.html: #${id} 없음`);
}
// 독송 플랜 — 마음 단련 연동 (주차별 목표·완주 보상)
const plan = readFileSync(join(root, 'plan.html'), 'utf8');
if (!plan.includes('id="planTrain"')) fail('plan.html: #planTrain 없음');
if ((plan.match(/data-week="/g) || []).length !== 26) fail('plan.html: 주차 표시(data-week)가 26개여야 합니다');
if (!plan.includes('assets/train.js')) fail('plan.html: assets/train.js 미포함');
ok('홈·자료실·소개 페이지 구조 확인');

console.log(errors ? `\n${errors}개 문제 발견` : '\n모든 검증 통과');
process.exit(errors ? 1 : 0);

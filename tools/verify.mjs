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
  if (!html.includes('aria-label="테마 선택"')) fail(`${p}: 테마 선택 그룹의 aria-label 없음`);
  if (!html.includes('"BreadcrumbList"')) fail(`${p}: 브레드크럼 구조화 데이터 없음`);
  if (!html.includes('data-tts-voice') || !html.includes('data-tts-rate')) fail(`${p}: 낭독 목소리·속도 선택 없음`);
  if (!html.includes('mailto:kaist2718@gmail.com')) fail(`${p}: 문의 이메일(kaist2718@gmail.com) 없음`);
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
    const target = join(root, ref.replace(/^\//, '').split('#')[0]);
    if (!existsSync(target)) fail(`${p}: 깨진 링크 ${ref}`);
  }
}
// 모든 정적 페이지에 문의 이메일이 실려 있는지 확인
for (const p of ['index.html', 'sources.html', 'about.html', 'glossary.html', 'plan.html', 'privacy.html', 'terms.html', '404.html']) {
  if (!readFileSync(join(root, p), 'utf8').includes('mailto:kaist2718@gmail.com')) fail(`${p}: 문의 이메일(kaist2718@gmail.com) 없음`);
}
// 404 는 모든 경로에서 서빙되므로 자산·링크가 절대 경로여야 합니다
const notFound = readFileSync(join(root, '404.html'), 'utf8');
if (!notFound.includes('href="/assets/site.css"')) fail('404.html: 절대 경로(/assets/site.css) 미사용 — 중첩 경로에서 스타일이 깨집니다');
if (/href="(?!\/|#|https?:|mailto:)/.test(notFound)) fail('404.html: 상대 경로 링크 — 모든 경로에서 깨질 수 있습니다');
const home = readFileSync(join(root, 'index.html'), 'utf8');
for (const id of ['toc', 'search', 'searchChapter', 'dailyVerse', 'training', 'trainPanel', 'trainMini']) {
  if (!home.includes(`id="${id}"`)) fail(`index.html: #${id} 없음`);
}
// 독송 플랜 — 마음 단련 연동 (주차별 목표·완주 보상)
const plan = readFileSync(join(root, 'plan.html'), 'utf8');
if (!plan.includes('id="planTrain"')) fail('plan.html: #planTrain 없음');
if ((plan.match(/data-week="/g) || []).length !== 26) fail('plan.html: 주차 표시(data-week)가 26개여야 합니다');
if (!plan.includes('assets/train.js')) fail('plan.html: assets/train.js 미포함');
ok('홈·자료실·소개 페이지 구조 확인');

// 5) 구조화 데이터(JSON-LD) — 검색엔진용 · 파싱 가능 여부까지 확인
for (const p of ['index.html', 'sources.html', 'glossary.html', 'plan.html', 'about.html']) {
  if (!readFileSync(join(root, p), 'utf8').includes('application/ld+json')) fail(`${p}: JSON-LD 구조화 데이터 없음`);
}
for (const p of ['index.html', 'sources.html', 'glossary.html', 'plan.html', 'about.html', 'privacy.html', 'terms.html', '404.html', ...pages.map((f) => 'chapters/' + f)]) {
  const html = readFileSync(join(root, p), 'utf8');
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { fail(`${p}: JSON-LD 파싱 실패 — ${e.message}`); }
  }
}
const glossary = readFileSync(join(root, 'glossary.html'), 'utf8');
const termEls = (glossary.match(/<li><strong>/g) || []).length;
const definedTerms = (glossary.match(/"@type":"DefinedTerm"/g) || []).length;
if (definedTerms !== termEls) fail(`glossary.html: 용어 ${termEls}개 중 구조화 데이터 ${definedTerms}개 — 수가 맞아야 합니다`);
if (!glossary.includes(`어휘 ${termEls}선`)) fail(`glossary.html: 「어휘 ${termEls}선」 표기가 실제 용어 수와 다릅니다`);
ok(`구조화 데이터(JSON-LD) 확인 — 용어 사전 ${definedTerms}개`);

// 6) sitemap — 공개 페이지 전체 수록 · lastmod · noindex 페이지 제외
const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
const locs = new Set([...sitemap.matchAll(/<loc>https:\/\/buddha\.monster\/([^<]*)<\/loc>/g)].map((m) => m[1] || 'index.html'));
const indexable = ['index.html', 'sources.html', 'glossary.html', 'plan.html', 'about.html', ...pages.map((f) => 'chapters/' + f)];
for (const p of indexable) {
  if (!locs.has(p)) fail(`sitemap.xml: ${p} 누락`);
}
for (const p of ['privacy.html', 'terms.html', '404.html']) {
  if (locs.has(p)) fail(`sitemap.xml: noindex 페이지 ${p} 는 넣지 않습니다`);
}
const urlBlocks = [...sitemap.matchAll(/<url>[\s\S]*?<\/url>/g)].map((m) => m[0]);
if (urlBlocks.length !== indexable.length) fail(`sitemap.xml: URL ${urlBlocks.length}개 — ${indexable.length}이어야 합니다`);
for (const b of urlBlocks) {
  if (!/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(b)) fail('sitemap.xml: lastmod 없는 URL — ' + b.slice(0, 80));
}
ok(`sitemap 확인 — ${locs.size}개 URL · lastmod 포함`);

console.log(errors ? `\n${errors}개 문제 발견` : '\n모든 검증 통과');
process.exit(errors ? 1 : 0);

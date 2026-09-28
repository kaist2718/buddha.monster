// 헤드리스 Chrome(CDP) 으로 주요 페이지 렌더링 확인 — node tools/browser-check.mjs
// Chrome 의 --dump-dom 가 이 환경에서 출력을 주지 않아, 원격 디버깅 프로토콜(CDP)로 직접 확인합니다.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };

// 1) 정적 서버
const server = createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const p = join(root, url === '/' ? 'index.html' : url.slice(1));
  if (!existsSync(p) || !p.startsWith(root)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// 2) Chrome 실행 (CDP)
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));
if (!CHROME) { console.log('Chrome 없음 — 건너뜀'); server.close(); process.exit(0); }

const DEBUG_PORT = 9337;
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${join(root, '.cache', 'chrome-prof')}`,
  `--remote-debugging-port=${DEBUG_PORT}`, 'about:blank',
], { windowsHide: true, detached: true, stdio: 'ignore' });

// CDP 엔드포인트 대기
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try {
    const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) wsUrl = page.webSocketDebuggerUrl;
  } catch {}
}
if (!wsUrl) { console.error('CDP 연결 실패'); try { chrome.kill(); } catch {} server.close(); process.exit(1); }

// 3) CDP 세션
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let msgId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++msgId;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result ? r.result.value : null;
};

// 4) 페이지별 확인
const pages = [
  { path: '/', verses: 0, ids: ['toc', 'search', 'dailyVerse', 'training', 'trainPanel', 'trainMini'] },
  { path: '/chapters/01.html', verses: 20, ids: ['trainStrip'] },
  // 229–230 은 원전에서 한 단락(병합 게송)이라 블록 13개가 맞습니다.
  { path: '/chapters/17.html', verses: 13, ids: [] },
  { path: '/chapters/26.html', verses: 41, ids: [] },
  { path: '/sources.html', verses: 0, ids: [] },
  { path: '/glossary.html', verses: 0, ids: [] },
  { path: '/plan.html', verses: 0, ids: ['planTrain'] },
  { path: '/privacy.html', verses: 0, ids: [] },
  { path: '/terms.html', verses: 0, ids: [] },
  { path: '/about.html', verses: 0, ids: [] },
];
let errors = 0;
for (const spec of pages) {
  await send('Page.navigate', { url: `http://127.0.0.1:${port}${spec.path}` });
  await new Promise((r) => setTimeout(r, 700));
  const info = await evaluate(`(function(){
    return {
      title: document.title,
      h1: (document.querySelector('h1')||{}).textContent || '',
      verses: document.querySelectorAll('.verse').length,
      pali: document.querySelectorAll('.verse-pali').length,
      themeBtns: document.querySelectorAll('[data-theme-option]').length,
      missingIds: ${JSON.stringify(spec.ids)}.filter(id => !document.getElementById(id)),
      brokenCss: getComputedStyle(document.body).fontFamily.length === 0,
      train: (function () {
        var panel = document.getElementById('trainPanel');
        var mini = document.getElementById('trainMini');
        var strip = document.getElementById('trainStrip');
        var s = null; try { s = JSON.parse(localStorage.getItem('buddha.train')); } catch (e) {}
        return {
          panelKids: panel ? panel.children.length : -1,
          miniKids: mini ? mini.children.length : -1,
          stripKids: strip ? strip.children.length : -1,
          xp: s ? s.xp : -1,
          quests: document.querySelectorAll('.train-quest').length,
          weeks: document.querySelectorAll('.week-item[data-week]').length,
          planKids: (document.getElementById('planTrain') || { children: [] }).children.length,
        };
      })(),
    };
  })()`);
  const problems = [];
  if (info.train) {
    if (spec.path === '/') {
      if (info.train.miniKids < 1) problems.push('수련 미니 카드 미표시');
      if (info.train.panelKids < 3) problems.push('수련 패널 미표시');
      if (info.train.quests !== 6) problems.push(`오늘의 수련 과제 ${info.train.quests} ≠ 6`);
    }
    if (spec.verses && info.train.stripKids < 1) problems.push('수련 스트립 미표시');
    if (spec.path === '/plan.html') {
      if (info.train.planKids < 1) problems.push('플랜 수련 패널 미표시');
      if (info.train.weeks !== 26) problems.push(`주차 표시 ${info.train.weeks} ≠ 26`);
    }
    if (info.train.xp <= 0) problems.push('마음 단련 기록 없음');
  } else problems.push('수련 시스템 점검 실패');
  if (!info.title) problems.push('title 없음');
  if (!info.h1.trim()) problems.push('h1 없음');
  if (spec.verses && info.verses !== spec.verses) problems.push(`게송 ${info.verses} ≠ ${spec.verses}`);
  if (info.missingIds.length) problems.push('누락 id: ' + info.missingIds.join(','));
  if (info.brokenCss) problems.push('CSS 미적용');
  if (spec.verses && info.pali !== spec.verses) problems.push(`팔리어 ${info.pali} ≠ ${spec.verses}`);
  if (!info.themeBtns) problems.push('테마 버튼 없음');
  if (problems.length) { errors++; console.log(`✗ ${spec.path} — ${problems.join(' / ')}`); }
  else console.log(`✓ ${spec.path} — "${info.h1.trim().slice(0, 24)}" 게송 ${info.verses} 팔리어 ${info.pali}`);
}

ws.close();
try { chrome.kill(); } catch {}
server.close();
console.log(errors ? `${errors}개 페이지 문제` : '브라우저 렌더링 확인 완료');
process.exit(errors ? 1 : 0);

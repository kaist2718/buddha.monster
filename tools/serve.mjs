#!/usr/bin/env node
/**
 * 로컬 미리보기 서버 — 프로젝트 루트를 배포와 같은 경로로 서빙합니다.
 *
 * 실행:  node tools/serve.mjs                (http://127.0.0.1:8000)
 *        node tools/serve.mjs --port 5000
 *        node tools/serve.mjs --open         (기본 브라우저로 열기)
 * 종료:  Ctrl+C
 *
 * 외부 의존성 없음(Node 내장 모듈만 사용).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const argv = process.argv.slice(2);
const portAt = argv.indexOf('--port');
const PORT = portAt >= 0 ? Number(argv[portAt + 1]) : 8000;
const wantOpen = argv.includes('--open');

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let p = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\/+/, ''));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) {
    // GitHub Pages 와 같이 없는 주소는 404.html 을 404 상태로
    const notFound = path.join(ROOT, '404.html');
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'not found');
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(fs.readFileSync(p));
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`미리보기: ${url}  (Ctrl+C 로 종료)`);
  if (wantOpen) {
    const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
  }
});

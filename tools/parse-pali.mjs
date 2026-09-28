// _source/pali/*.json (SuttaCentral bilara-data, Mahāsaṅgīti 팔리어 원문) → data/verses-pali.json
// 키 형식 "dhpN:M"에서 N=게송 번호, M=줄 번호(0.x 는 품 제목·전거 이야기 머리글 — 제외).
// 팔리어 경전 원문은 공중도메인입니다.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, '_source', 'pali');

const byVerse = {};
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  for (const [key, val] of Object.entries(data)) {
    const m = key.match(/^dhp(\d+):(\d+)$/);
    if (!m) continue; // dhp1:0.x 머리글 제외
    const n = Number(m[1]);
    (byVerse[n] = byVerse[n] || []).push(String(val).trim());
  }
}

// 줄을 하나의 게송 문자열로 — 줄 끝의 쉼표/세미콜론을 유지하고 공백으로 연결
const verses = {};
for (const [n, lines] of Object.entries(byVerse)) {
  let text = lines.join(' ').replace(/\s+/g, ' ').trim();
  text = text.replace(/[,;]$/, ''); // 마지막 구두점 정리
  verses[Number(n)] = text;
}

const nums = Object.keys(verses).map(Number).sort((a, b) => a - b);
const missing = [];
for (let i = 1; i <= 423; i++) if (!verses[i]) missing.push(i);
console.log(`팔리어 게송 ${nums.length}개 (1~423)`);
if (missing.length) console.log('누락:', missing.join(', '));

mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(
  join(root, 'data', 'verses-pali.json'),
  JSON.stringify({ source: 'SuttaCentral bilara-data (Mahāsaṅgīti), public domain', verses }, null, 2) + '\n'
);
console.log('data/verses-pali.json 저장 완료');

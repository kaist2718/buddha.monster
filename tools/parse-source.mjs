// _source/pg2017.txt (F. Max Müller, 1881 — public domain) → data/verses-en.json
// 챕터 헤더와 번호 게송을 파싱해 영어 게송 데이터를 만듭니다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const raw = readFileSync('_source/pg2017.txt', 'utf8').replace(/\r\n/g, '\n');

// 본문 시작: "Chapter I. The Twin-Verses"
const start = raw.indexOf('Chapter I. The Twin-Verses');
if (start < 0) throw new Error('본문 시작을 찾지 못했습니다');
// 끝: Project Gutenberg 꼬리말
const end = raw.indexOf('*** END OF THE PROJECT GUTENBERG');
const body = raw.slice(start, end > 0 ? end : undefined);

const chapterRe = /^Chapter ([IVXL]+)\.\s*(.+?)\s*$/gm;
const romanToNum = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20, XXI: 21, XXII: 22, XXIII: 23, XXIV: 24, XXV: 25, XXVI: 26 };

// 챕터 위치 수집
const marks = [];
for (const m of body.matchAll(chapterRe)) {
  marks.push({ index: m.index, len: m[0].length, num: romanToNum[m[1]], title: m[2] });
}
if (marks.length !== 26) throw new Error(`챕터 수 ${marks.length} — 26이어야 합니다`);

const chapters = [];
for (let c = 0; c < marks.length; c++) {
  const segStart = marks[c].index + marks[c].len;
  const segEnd = c + 1 < marks.length ? marks[c + 1].index : body.length;
  const seg = body.slice(segStart, segEnd);

  // 게송: "N. text..." — 빈 줄로 구분된 단락
  const verses = [];
  const blocks = seg.split(/\n\s*\n/);
  for (const block of blocks) {
    const t = block.trim();
    if (!t) continue;
    // Max Müller 번역은 "58, 59." 처럼 두 게송을 하나로 묶은 단락이 있습니다.
    const m = t.match(/^(\d+(?:,\s*\d+)*)\.\s+([\s\S]+)$/);
    if (!m) continue;
    const nums = m[1].split(/,\s*/).map(Number);
    // 본문 안 줄바꿈을 공백 하나로 정리
    const text = m[2].replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
    verses.push({ n: nums[0], nEnd: nums[nums.length - 1], en: text });
  }
  // 번호 순서 검증 (챕터 시작 번호는 연속적이지 않을 수 있으므로 오름차순만 확인)
  for (let i = 1; i < verses.length; i++) {
    if (verses[i].n <= verses[i - 1].n) throw new Error(`챕터 ${marks[c].num}: 게송 번호가 오르막이 아닙니다`);
  }
  chapters.push({ num: marks[c].num, title: marks[c].title, verses });
}

// 전체 게송 수 검증
const total = chapters.reduce((s, ch) => s + ch.verses.length, 0);
const numbers = chapters.flatMap((ch) => ch.verses.flatMap((v) => {
  const out = [];
  for (let n = v.n; n <= (v.nEnd || v.n); n++) out.push(n);
  return out;
}));
const uniq = new Set(numbers);
console.log('챕터:', chapters.length, '게송(단락):', total, '고유 번호:', uniq.size);
const expected = new Set();
for (let i = 1; i <= 423; i++) expected.add(i);
const missing = [...expected].filter((n) => !uniq.has(n));
if (missing.length) console.log('누락 번호:', missing.join(', '));

mkdirSync('data', { recursive: true });
writeFileSync('data/verses-en.json', JSON.stringify({ source: 'F. Max Müller (1881), public domain', chapters }, null, 2) + '\n');
console.log('data/verses-en.json 저장 완료');

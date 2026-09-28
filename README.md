# 마음의 괴물을 다스리는 부처님 — buddha.monster

부제: 마음을 다스리는 부처님처럼 살기

법구경(Dhammapada) 26품 423게송을 **영어 원문 + 우리말 번역**으로 모두 담은 정적 사이트입니다.
빌드 프레임워크 없이 HTML + CSS + JS로만 이루어져 있으며, `01_toeic`·`02_engmon`의 디자인·구조 규칙을 따릅니다.

## 시작하기

```bash
npm run build                # 챕터 26페이지 + 검색 데이터 + sitemap.xml 생성
node tools/verify.mjs        # 게송 수·번역 누락·링크·구조화 데이터·sitemap 검증
node tools/browser-check.mjs # 헤드리스 Chrome 렌더링 확인 (선택)
```

## 구조

```
index.html          홈 — 표지 · 오늘의 법구 · 26품 목차 · 게송 검색(초성·오타 보정)
sources.html        영어로 읽는 법구경 자료실 (영어 원문 사이트 8곳 안내)
glossary.html       용어 사전 — 법구경 핵심 어휘 팔리어·영어·한국어 32선
plan.html           26주 독송 플랜 — 6개월 완주 로드맵
about.html          이 책에 대하여 — 법구경 소개 · 사용법 · 저작권 안내
privacy.html        개인정보처리방침
terms.html          이용약관
404.html            없는 주소 안내 (GitHub Pages 커스텀 404)
chapters/           생성된 품별 페이지 26개 (제1품 ~ 제26품)
                    — 게송마다 팔리어 원문 · 영어 원문 · 우리말 번역 병기
                    — 영어 낭독(게송별 재생 · 일시정지 · 이어듣기)
data/
  verses-en.json    영어 원문 — F. Max Müller(1881, 공중도메인)
  verses-pali.json  팔리어 원문 — SuttaCentral bilara-data(Mahāsaṅgīti)
  ko-1.js ~ ko-6.js 우리말 번역 (게송 번호별 — 자체 번역)
  chapters.js       26품 메타 — 품 이름·팔리어·해설·마음 다스리기 실천
  search-index.js   생성물 — 홈 검색·오늘의 법구용 데이터
assets/
  site.css          스타일 (라이트/다크 테마 · 반응형 · 인쇄용)
  app.js            공통 스크립트 (테마 선택·TTS 낭독·번역 토글·인용 복사·검색·sw 등록)
  train.js          마음 단련 — 수련 레벨·경험치·연속 수련·배지·26주 플랜 연동
                    (주차별 목표·완주 보상·레벨업 축하 효과, localStorage 기록)
  fonts/            Pretendard 서브셋 (tools/make-font-subset.py 로 생성)
manifest.webmanifest · sw.js   PWA — 설치형 앱 · 오프라인 핵심 캐시
docs/              기획 자료 — MONETIZATION(수익화 기획서) · ROADMAP(제품 로드맵) — 배포 대상 아님
tools/              parse-source · parse-pali · build-pages · build-sitemap · verify
                    · browser-check · serve · stage-site · font-charset
                    · make-font-subset · make-icons
_source/            Gutenberg 원문 · SuttaCentral 팔리어 원문 (파싱 입력 — 배포 대상 아님)
CNAME · robots.txt · sitemap.xml · icon.svg · icon-*.png · og.png
```

## 판본과 저작권

- **영어 원문**: F. Max Müller 번역(『동양의 성전』 제10권, 1881) — **공중도메인**.
  Project Gutenberg eBook #2017에서 내려받아 `tools/parse-source.mjs`로 파싱했습니다.
- **팔리어 원문**: Mahāsaṅgīti 판(SuttaCentral bilara-data) — **공중도메인**.
  `tools/parse-pali.mjs`로 게송 번호별 데이터로 변환했습니다.
- **우리말 번역·해설·실천 문장·용어 사전**: 이 사이트를 위해 새로 작성했습니다.
- **서체**: Pretendard Variable(SIL OFL 1.1) — 사이트에 나오는 글자만 담은 자체 호스팅 서브셋.

## 문의

문의·오류 제보: **kaist2718@gmail.com**

## 방문 분석

자체 호스팅 분석 스크립트를 씁니다(쿠키 미사용 → 동의 배너 불필요).
수집 서버 주소와 사이트 ID는 `assets/analytics.js` 한 곳에서 정합니다.

```js
s.src = 'https://visitor-analytics-a5bp.onrender.com/analytics.js';
s.setAttribute('data-domain', 'buddha.monster');
```

## 데이터 규칙

- 게송 번호는 표준 번호 체계(1–423)를 씁니다. 원전에서 두 게송이 한 단락인 경우
  `n`과 `nEnd`로 범위를 표시합니다(예: 58–59, 229–230 — 9곳).
- 우리말 번역은 블록 시작 번호를 키로 씁니다(총 414개 블록 = 423게송 번호 커버).
- 품별 해설·실천 문장은 `data/chapters.js` 한 곳에서 관리합니다.
- 「마음 단련」 수련 기록은 브라우저 localStorage(`buddha.train`)에만 저장하며 서버로 전송하지 않습니다.
  기기 변경 시 홈 「마음 단련」의 기록 내보내기·가져오기로 옮길 수 있습니다.

## 콘텐츠를 고치면

1. `data/ko-*.js` 또는 `data/chapters.js` 수정
2. `npm run build` — 챕터 페이지·검색 데이터·sitemap.xml 재생성
3. `python tools/make-font-subset.py` — 새 글자가 생겼으면 서브셋 재생성
4. `node tools/verify.mjs` — 검증 통과 확인
5. `npm run stage` — 배포본 점검 후 커밋·푸시 (CI 와 배포 워크플로가 자동 실행됩니다)

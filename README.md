# 마음의 괴물을 다스리는 부처님 — buddha.monster

부제: 마음을 다스리는 부처님처럼 살기

법구경(Dhammapada) 26품 423게송을 **영어 원문 + 우리말 번역**으로 모두 담은 정적 사이트입니다.
빌드 프레임워크 없이 HTML + CSS + JS로만 이루어져 있으며, `01_toeic`·`02_engmon`의 디자인·구조 규칙을 따릅니다.

## 시작하기

```bash
node tools/build-pages.mjs   # 챕터 26페이지 + 검색 데이터 생성
node tools/verify.mjs        # 게송 수·번역 누락·링크 검증
node tools/browser-check.mjs # 헤드리스 Chrome 렌더링 확인 (선택)
```

## 구조

```
index.html          홈 — 표지 · 오늘의 법구 · 26품 목차 · 게송 검색
sources.html        영어로 읽는 법구경 자료실 (영어 원문 사이트 8곳 안내)
about.html          이 책에 대하여 — 법구경 소개 · 사용법 · 저작권 안내
chapters/           생성된 품별 페이지 26개 (제1품 ~ 제26품)
data/
  verses-en.json    영어 원문 (tools/parse-source.mjs 로 생성)
  ko-1.js ~ ko-6.js 우리말 번역 (게송 번호별 — 자체 번역)
  chapters.js       26품 메타 — 품 이름·팔리어·해설·마음 다스리기 실천
  search-index.js   생성물 — 홈 검색·오늘의 법구용 데이터
assets/
  site.css          스타일 (라이트/다크 · 반응형 · 인쇄용)
  app.js            공통 스크립트 (메뉴·테마·TTS 낭독·우리말 토글·검색)
  fonts/            Pretendard 서브셋 (tools/make-font-subset.py 로 생성)
tools/              parse-source · build-pages · verify · browser-check
                    · font-charset · make-font-subset
_source/            Gutenberg 원문 (파싱 입력 — 배포 대상 아님)
CNAME · robots.txt · sitemap.xml · icon.svg
```

## 판본과 저작권

- **영어 원문**: F. Max Müller 번역(『동양의 성전』 제10권, 1881) — **공중도메인**.
  Project Gutenberg eBook #2017에서 내려받아 `tools/parse-source.mjs`로 파싱했습니다.
- **우리말 번역·해설·실천 문장**: 이 사이트를 위해 새로 작성했습니다.
- **서체**: Pretendard Variable(SIL OFL 1.1) — 사이트에 나오는 글자만 담은 자체 호스팅 서브셋.

## 데이터 규칙

- 게송 번호는 표준 번호 체계(1–423)를 씁니다. 원전에서 두 게송이 한 단락인 경우
  `n`과 `nEnd`로 범위를 표시합니다(예: 58–59, 229–230 — 9곳).
- 우리말 번역은 블록 시작 번호를 키로 씁니다(총 414개 블록 = 423게송 번호 커버).
- 품별 해설·실천 문장은 `data/chapters.js` 한 곳에서 관리합니다.

## 콘텐츠를 고치면

1. `data/ko-*.js` 또는 `data/chapters.js` 수정
2. `node tools/build-pages.mjs` — 챕터 페이지 재생성
3. `python tools/make-font-subset.py` — 새 글자가 생겼으면 서브셋 재생성
4. `node tools/verify.mjs` — 검증 통과 확인

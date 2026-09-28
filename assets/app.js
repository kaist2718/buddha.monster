// 마음의 괴물을 다스리는 부처님 — 페이지 공통 스크립트
// 기능별로 나누어 초기화하고, 한 기능이 실패해도 나머지는 동작합니다.
(function () {
  'use strict';

  function guard(name, fn) {
    try { fn(); } catch (e) { console.warn('[' + name + '] 초기화 실패:', e); }
  }

  // ── 모바일 메뉴 ────────────────────────────────────────
  guard('menu', function () {
    var btn = document.getElementById('menuBtn');
    var nav = document.getElementById('nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // ── 테마 (선택 저장 · 기본값은 시스템 설정) ──────────────
  guard('theme', function () {
    var KEY = 'buddha.theme';
    var root = document.documentElement;
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    var mode = saved === 'light' || saved === 'dark' ? saved : 'system';

    function apply() {
      var dark = mode === 'dark' || (mode === 'system' && window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
      document.querySelectorAll('[data-theme-option]').forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-theme-option') === mode ? 'true' : 'false');
      });
    }
    apply();
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if (mode === 'system') apply(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-theme-option]') : null;
      if (!btn) return;
      mode = btn.getAttribute('data-theme-option');
      try { localStorage.setItem(KEY, mode); } catch (err) {}
      apply();
    });
  });

  // ── 영어 낭독 (speechSynthesis) ──────────────────────
  // 게송 단위 대기열로 재생해 일시정지·이어듣기·정지를 모두 지원합니다.
  // (한 덩어리로 길게 읽으면 음성합성이 중간에 끊기는 경우가 있어 문장 단위로 나눕니다)
  guard('tts', function () {
    if (!('speechSynthesis' in window)) return;

    var session = { items: [], i: 0, mode: 'idle', chapter: false }; // idle|playing|paused|stopped
    var gen = 0; // 이전 재생의 콜백이 새 재생을 건드리지 않게 하는 표식
    var bar = null, statusEl = null, pauseBtn = null, keepAlive = 0;

    // ── 목소리·속도 선택 (선택은 기기에 저장) ──────────
    var voiceSel = document.querySelector('[data-tts-voice]');
    var rateSel = document.querySelector('[data-tts-rate]');
    function escAttr(s) {
      return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }
    function currentRate() {
      return (rateSel && parseFloat(rateSel.value)) || 0.92;
    }
    function currentVoice() {
      if (!voiceSel || !voiceSel.value) return null;
      var voices = window.speechSynthesis.getVoices() || [];
      for (var i = 0; i < voices.length; i++) {
        if ((voices[i].voiceURI || voices[i].name) === voiceSel.value) return voices[i];
      }
      return null;
    }
    function fillVoices() {
      if (!voiceSel) return;
      var voices = window.speechSynthesis.getVoices() || [];
      var en = voices.filter(function (v) { return /^en/i.test(v.lang); });
      var list = en.length ? en : voices;
      if (!list.length) return; // 목소리 목록이 아직 없으면 기본 목소리만
      var html = '<option value="">기본 목소리</option>';
      list.forEach(function (v) {
        html += '<option value="' + escAttr(v.voiceURI || v.name) + '">' + escAttr(v.name) + ' (' + escAttr(v.lang) + ')</option>';
      });
      voiceSel.innerHTML = html;
      try {
        var saved = localStorage.getItem('buddha.tts.voice');
        if (saved) voiceSel.value = saved;
      } catch (e) {}
    }
    fillVoices();
    if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', fillVoices);
    else window.speechSynthesis.onvoiceschanged = fillVoices;
    if (voiceSel) voiceSel.addEventListener('change', function () {
      try { localStorage.setItem('buddha.tts.voice', voiceSel.value); } catch (e) {}
    });
    if (rateSel) {
      try {
        var savedRate = localStorage.getItem('buddha.tts.rate');
        if (savedRate) rateSel.value = savedRate;
      } catch (e) {}
      rateSel.addEventListener('change', function () {
        try { localStorage.setItem('buddha.tts.rate', rateSel.value); } catch (e) {}
      });
    }

    // 긴 게송은 문장 단위로 나눠 재생합니다
    function splitSpeech(text) {
      var parts = text.match(/[^.!?]+[.!?]*/g) || [text];
      var chunks = [], buf = '';
      parts.forEach(function (s) {
        if (buf && (buf + s).length > 180) { chunks.push(buf.trim()); buf = ''; }
        buf += s;
      });
      if (buf.trim()) chunks.push(buf.trim());
      return chunks.length ? chunks : [text];
    }

    function ensureBar() {
      if (bar) return;
      bar = document.createElement('div');
      bar.className = 'tts-bar';
      bar.setAttribute('role', 'status');
      bar.setAttribute('aria-live', 'polite');
      bar.innerHTML =
        '<span class="tts-bar-status"></span>' +
        '<button class="tts-bar-btn" type="button" data-tts-pause aria-label="낭독 일시정지 또는 이어서 듣기">일시정지</button>' +
        '<button class="tts-bar-btn" type="button" data-tts-stop aria-label="낭독 정지">정지</button>';
      document.body.appendChild(bar);
      statusEl = bar.querySelector('.tts-bar-status');
      pauseBtn = bar.querySelector('[data-tts-pause]');
      pauseBtn.addEventListener('click', togglePause);
      bar.querySelector('[data-tts-stop]').addEventListener('click', stop);
    }

    function clearSpeaking() {
      document.querySelectorAll('.verse.speaking').forEach(function (v) { v.classList.remove('speaking'); });
      document.querySelectorAll('[data-speaking="true"]').forEach(function (b) { b.removeAttribute('data-speaking'); });
    }

    function setBtnLabel() {
      document.querySelectorAll('[data-tts-all]').forEach(function (b) {
        if (session.chapter && (session.mode === 'playing' || session.mode === 'paused')) b.textContent = '낭독 정지';
        else if (session.chapter && session.mode === 'stopped' && session.i > 0 && session.i < session.items.length) {
          b.textContent = '이어듣기 — ' + session.items[session.i].num + '게송부터';
        } else b.textContent = '이 품 영어 낭독';
      });
    }

    function updateBar() {
      ensureBar();
      var active = session.mode === 'playing' || session.mode === 'paused';
      bar.classList.toggle('show', active);
      if (active) {
        var cur = session.items[Math.min(session.i, session.items.length - 1)];
        statusEl.textContent = (session.mode === 'paused' ? '일시정지 중' : '낭독 중') + ' · ' +
          Math.min(session.i + 1, session.items.length) + ' / ' + session.items.length +
          (cur ? ' · ' + cur.num + '게송' : '');
        pauseBtn.textContent = session.mode === 'paused' ? '이어서 듣기' : '일시정지';
      }
      setBtnLabel();
    }

    function stop() {
      gen++;
      window.speechSynthesis.cancel();
      clearInterval(keepAlive);
      session.mode = (session.chapter && session.i > 0 && session.i < session.items.length) ? 'stopped' : 'idle';
      clearSpeaking();
      updateBar();
    }

    function playFrom(idx) {
      gen++;
      window.speechSynthesis.cancel();
      clearInterval(keepAlive);
      session.i = idx;
      session.mode = 'playing';
      speakNext();
      updateBar();
    }

    function speakNext() {
      if (session.mode !== 'playing') return;
      if (session.i >= session.items.length) {
        session.mode = 'idle';
        clearInterval(keepAlive);
        clearSpeaking();
        updateBar();
        return;
      }
      var myGen = gen;
      var item = session.items[session.i];
      clearSpeaking();
      if (item.el) {
        item.el.classList.add('speaking');
        var vb = item.el.querySelector('.tts-btn');
        if (vb) vb.setAttribute('data-speaking', 'true');
      }
      var u = new SpeechSynthesisUtterance(item.text);
      u.lang = 'en-US';
      u.rate = currentRate();
      var uv = currentVoice();
      if (uv) u.voice = uv;
      u.onend = function () {
        if (myGen !== gen || session.mode === 'idle' || session.mode === 'stopped') return;
        session.i += 1;
        speakNext();
      };
      u.onerror = u.onend;
      window.speechSynthesis.speak(u);
      updateBar();
    }

    function togglePause() {
      if (session.mode === 'playing') {
        window.speechSynthesis.pause();
        session.mode = 'paused';
        // Chrome 은 일시정지가 오래되면 풀리는 경우가 있어 일시정지를 되풀이해 붙잡아 둡니다
        keepAlive = setInterval(function () { window.speechSynthesis.pause(); }, 5000);
      } else if (session.mode === 'paused') {
        clearInterval(keepAlive);
        session.mode = 'playing';
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.resume();
        else speakNext(); // 끊긴 뒤에는 이어서 다시 재생
      }
      updateBar();
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.tts-btn, [data-tts-all]') : null;
      if (!btn) return;
      if (btn.hasAttribute('data-tts-all')) {
        // 재생 중이면 정지(이어듣기 지점 남김), 멈춘 곳이 있으면 이어서, 그 외에는 처음부터
        if (session.chapter && (session.mode === 'playing' || session.mode === 'paused')) { stop(); return; }
        if (session.chapter && session.mode === 'stopped' && session.i > 0 && session.i < session.items.length) {
          playFrom(session.i);
          return;
        }
        var chapter = btn.closest('.chapter');
        if (!chapter) return;
        var items = [];
        chapter.querySelectorAll('.verse').forEach(function (art) {
          var p = art.querySelector('.verse-en');
          if (!p) return;
          var num = art.getAttribute('data-verse') || '';
          splitSpeech(p.textContent.trim()).forEach(function (t) {
            items.push({ text: t, el: art, num: num });
          });
        });
        if (!items.length) return;
        session.items = items;
        session.chapter = true;
        playFrom(0);
      } else {
        var art = btn.closest('.verse');
        var p = art && art.querySelector('.verse-en');
        if (!p) return;
        session.items = splitSpeech(p.textContent.trim()).map(function (t) {
          return { text: t, el: art, num: art.getAttribute('data-verse') || '' };
        });
        session.chapter = false;
        playFrom(0);
      }
    });
  });

  // ── 우리말 가리기 토글 ────────────────────────────────
  guard('ko-toggle', function () {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-ko-toggle]') : null;
      if (!btn) return;
      var hidden = document.body.getAttribute('data-hide-ko') === 'true';
      document.body.setAttribute('data-hide-ko', hidden ? 'false' : 'true');
      btn.textContent = hidden ? '우리말 가리기' : '우리말 보이기';
    });
  });

  // ── 팔리어 가리기 토글 ────────────────────────────────
  guard('pali-toggle', function () {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-pali-toggle]') : null;
      if (!btn) return;
      var hidden = document.body.getAttribute('data-hide-pali') === 'true';
      document.body.setAttribute('data-hide-pali', hidden ? 'false' : 'true');
      btn.textContent = hidden ? '팔리어 가리기' : '팔리어 보이기';
      btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    });
  });

  // ── 읽기 진행률 + 맨 위로 ────────────────────────
  guard('progress', function () {
    var bar = document.createElement('div');
    bar.className = 'read-bar';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span class="read-bar-fill"></span>';
    document.body.appendChild(bar);
    var fill = bar.firstChild;
    var top = document.createElement('button');
    top.className = 'to-top';
    top.type = 'button';
    top.setAttribute('aria-label', '맨 위로');
    top.textContent = '↑';
    document.body.appendChild(top);
    top.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    function onScroll() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      fill.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
      top.classList.toggle('show', window.scrollY > 500);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });

  // ── 모바일 하단 탭바 ──────────────────────────────
  guard('mobile-tab', function () {
    var scripts = document.getElementsByTagName('script');
    var src = scripts.length ? scripts[scripts.length - 1].src : '';
    var base = src.replace(/assets\/app\.js.*$/, '');
    if (!base) base = './';
    var isChapters = /\/chapters\//.test(location.pathname);
    var p = isChapters ? '../' : base;
    var items = [
      { href: p + 'index.html', icon: '🏠', label: '홈' },
      { href: p + 'index.html#toc', icon: '📖', label: '목차' },
      { href: p + 'index.html#search', icon: '🔍', label: '검색' },
      { href: p + 'plan.html', icon: '📅', label: '플랜' },
      { href: p + 'glossary.html', icon: '📿', label: '사전' },
    ];
    var nav = document.createElement('nav');
    nav.className = 'tab-bar';
    nav.setAttribute('aria-label', '빠른 이동');
    nav.innerHTML = items.map(function (it) {
      return '<a href="' + it.href + '"><span aria-hidden="true">' + it.icon + '</span><span>' + it.label + '</span></a>';
    }).join('');
    document.body.appendChild(nav);
  });

  // ── 글자 크기 조절 ────────────────────────────────
  guard('fontsize', function () {
    var KEY = 'buddha.fontsize';
    var sizes = ['100%', '112%', '125%'];
    var idx = 0;
    try { idx = Number(localStorage.getItem(KEY)) || 0; } catch (e) {}
    function apply() {
      document.documentElement.style.fontSize = sizes[idx] || sizes[0];
      document.querySelectorAll('[data-font-step]').forEach(function (b) {
        b.textContent = '글자 ' + ['보통', '큼', '가장 큼'][idx];
      });
    }
    apply();
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-font-step]') : null;
      if (!btn) return;
      idx = (idx + 1) % sizes.length;
      try { localStorage.setItem(KEY, String(idx)); } catch (err) {}
      apply();
    });
  });

  // ── 암송 모드 (본문 가리기 → 눌러서 확인) ─────────
  guard('memorize', function () {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-memorize-toggle]') : null;
      if (btn) {
        var on = document.body.getAttribute('data-memorize') === 'true';
        document.body.setAttribute('data-memorize', on ? 'false' : 'true');
        btn.textContent = on ? '암송 모드' : '암송 모드 끄기';
        btn.setAttribute('aria-pressed', on ? 'false' : 'true');
        if (!on) {
          document.querySelectorAll('.verse.revealed').forEach(function (v) {
            v.classList.remove('revealed');
          });
        }
        return;
      }
      if (document.body.getAttribute('data-memorize') !== 'true') return;
      var verse = e.target.closest ? e.target.closest('.verse') : null;
      if (verse) verse.classList.toggle('revealed');
    });
  });

  // ── 이어 읽기 (마지막으로 읽은 게송 기억) ──────────
  guard('resume', function () {
    var KEY = 'buddha.lastRead';
    var verseEl = document.querySelector('.verse[data-verse]');
    if (verseEl) {
      // 챕터 페이지: 읽기 시작한 게송 기록
      var ch = (location.pathname.match(/(\d{2})\.html/) || [])[1];
      if (ch) {
        try {
          localStorage.setItem(KEY, JSON.stringify({ ch: ch, n: verseEl.getAttribute('data-verse'), at: Date.now() }));
        } catch (e) {}
      }
      return;
    }
    // 홈: 이어 읽기 카드
    var box = document.getElementById('resumeBox');
    if (!box) return;
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!saved || !saved.ch) return;
    box.innerHTML = '<a class="btn btn-primary" href="chapters/' + saved.ch + '.html#v' + saved.n + '">이어 읽기 — 제' + Number(saved.ch) + '품 ' + saved.n + '게송 →</a>';
  });

  // ── 서비스 워커 등록 (오프라인 캐시) ────────────────
  guard('sw', function () {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    var scripts = document.getElementsByTagName('script');
    var src = scripts.length ? scripts[scripts.length - 1].src : '';
    var base = src.replace(/assets\/app\.js.*$/, '');
    if (!base) base = './';
    navigator.serviceWorker.register(base + 'sw.js').catch(function () {});
  });

  // ── 게송 인용 복사 ────────────────────────────────────
  guard('copy', function () {
    if (!navigator.clipboard) return;
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-copy]') : null;
      if (!btn) return;
      var art = btn.closest('.verse');
      if (!art) return;
      var num = art.getAttribute('data-verse');
      var pali = art.querySelector('.verse-pali');
      var en = art.querySelector('.verse-en');
      var ko = art.querySelector('.verse-ko');
      var parts = ['법구경 ' + num + '게송'];
      if (pali && pali.textContent.trim()) parts.push(pali.textContent.trim());
      if (en) parts.push(en.textContent.trim());
      if (ko) parts.push(ko.textContent.trim());
      parts.push('— 「마음의 괴물을 다스리는 부처님」 (buddha.monster)');
      navigator.clipboard.writeText(parts.join('\n')).then(function () {
        var old = btn.textContent;
        btn.textContent = '복사됨!';
        setTimeout(function () { btn.textContent = old; }, 1500);
      });
    });
  });

  // ── 홈: 오늘의 법구 ───────────────────────────────────
  guard('daily', function () {
    var box = document.getElementById('dailyVerse');
    if (!box || !window.DHP_INDEX) return;
    var flat = [];
    window.DHP_INDEX.forEach(function (ch) {
      ch.verses.forEach(function (v) { flat.push({ ch: ch, v: v }); });
    });
    if (!flat.length) return;
    var now = new Date();
    var dayNum = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
    var pick = flat[dayNum % flat.length];
    var numLabel = pick.v.nEnd !== pick.v.n ? pick.v.n + '–' + pick.v.nEnd : String(pick.v.n);
    box.innerHTML =
      '<p class="daily-label">오늘의 법구</p>' +
      '<p class="daily-en" lang="en"></p>' +
      '<p class="daily-ko"></p>' +
      '<p class="daily-meta">법구경 ' + numLabel + '게송 · 제' + pick.ch.num + '품 ' + pick.ch.ko + '</p>';
    box.querySelector('.daily-en').textContent = pick.v.en;
    box.querySelector('.daily-ko').textContent = pick.v.ko;
    var link = document.createElement('p');
    link.innerHTML = '<a class="btn btn-ghost" href="chapters/' +
      String(pick.ch.num).padStart(2, '0') + '.html#v' + pick.v.n + '">이 게송이 실린 품 읽기 →</a>';
    box.appendChild(link);
  });

  // ── 홈: 게송 검색 (초성 검색 · 오타 보정 · 품별 필터) ───
  guard('search', function () {
    var input = document.getElementById('searchInput');
    var out = document.getElementById('searchResults');
    if (!input || !out || !window.DHP_INDEX) return;

    // 초성 검색 — 한글 음절에서 첫소리만 뽑아 대조합니다 (예: ㅎㄴ → 하늘)
    var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
    function chosung(s) {
      var r = '';
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        if (c >= 0xac00 && c <= 0xd7a3) r += CHO.charAt(Math.floor((c - 0xac00) / 588));
        else if ((c >= 0x3131 && c <= 0x314e) || c === 32) r += s.charAt(i);
      }
      return r;
    }

    // 오타 보정 — 편집 거리(넣기·지우기·바꾸기·인접 뒤바꿈)가 max 이하이면 같은 낱말로 봅니다
    function isNear(a, b, max) {
      if (Math.abs(a.length - b.length) > max) return false;
      var prevPrev = null, prev = [], cur = [];
      for (var j = 0; j <= b.length; j++) prev.push(j);
      for (var i = 1; i <= a.length; i++) {
        cur = [i];
        var rowMin = i;
        for (var k = 1; k <= b.length; k++) {
          var cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
          var v = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + cost);
          if (i > 1 && k > 1 && a.charAt(i - 1) === b.charAt(k - 2) && a.charAt(i - 2) === b.charAt(k - 1)) {
            v = Math.min(v, prevPrev[k - 2] + 1); // 인접 글자 뒤바꿈
          }
          cur[k] = v;
          if (v < rowMin) rowMin = v;
        }
        if (rowMin > max) return false; // 이미 넘었으면 그만
        prevPrev = prev;
        prev = cur;
      }
      return prev[b.length] <= max;
    }

    // 일치한 자리에 <mark> 를 넣습니다 — 본문은 HTML 을 이스케이프해 안전하게
    function escHtml(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function markUp(text, ranges) {
      var merged = ranges.slice().sort(function (a, b) { return a[0] - b[0]; });
      var html = '', pos = 0;
      merged.forEach(function (r) {
        if (r[0] < pos) return; // 겹치는 범위는 건너뜁니다
        html += escHtml(text.slice(pos, r[0])) + '<mark>' + escHtml(text.slice(r[0], r[1])) + '</mark>';
        pos = r[1];
      });
      return html + escHtml(text.slice(pos));
    }
    function wordsWithPos(s) {
      var r = [], re = /[a-z0-9가-힣']+/g, m;
      while ((m = re.exec(s))) r.push({ w: m[0], s: m.index, e: m.index + m[0].length });
      return r;
    }

    var flat = [];
    window.DHP_INDEX.forEach(function (ch) {
      ch.verses.forEach(function (v) {
        var enL = v.en.toLowerCase();
        var koL = String(v.ko || '').toLowerCase();
        flat.push({
          n: v.n, nEnd: v.nEnd, en: v.en, ko: v.ko, ch: ch.num, chKo: ch.ko,
          enL: enL, koL: koL,
          enWords: wordsWithPos(enL),
          koWords: wordsWithPos(koL),
        });
      });
    });

    // 품별 필터 — 고른 품 안에서만 찾습니다
    var filterSel = document.getElementById('searchChapter');
    if (filterSel) {
      window.DHP_INDEX.forEach(function (ch) {
        var o = document.createElement('option');
        o.value = String(ch.num);
        o.textContent = '제' + ch.num + '품 ' + ch.ko;
        filterSel.appendChild(o);
      });
      filterSel.addEventListener('change', function () { render(input.value); });
    }

    function render(q) {
      q = q.trim().toLowerCase();
      if (q.length < 1) {
        out.innerHTML = '<p class="search-note">단어나 문장을 입력하면 423게송에서 찾아 드립니다. 한글 초성(예: ㅎㄴ)과 오타(예: hatread)도 찾아 드립니다.</p>';
        return;
      }
      var tokens = q.split(/\s+/).filter(Boolean);
      var choseong = /^[ㄱ-ㅎ\s]+$/.test(q);
      var only = filterSel ? Number(filterSel.value) : 0;
      var hits = [];
      for (var i = 0; i < flat.length; i++) {
        var v = flat[i];
        if (only && v.ch !== only) continue;
        var score = 0, matchedAll = true;
        var enRanges = [], koRanges = [];
        for (var t = 0; t < tokens.length; t++) {
          var tok = tokens[t], s = 0;
          if (choseong) {
            var cw = v.koWords.filter(function (x) { return chosung(x.w).indexOf(tok) >= 0; });
            if (cw.length) {
              s = 2; // 초성 검색 — 맞은 낱말을 통째로 강조
              cw.forEach(function (x) { koRanges.push([x.s, x.e]); });
            }
          } else if (v.enL.indexOf(tok) >= 0 || v.koL.indexOf(tok) >= 0) {
            s = 3; // 정확히 들어 있는 낱말
            var ei = v.enL.indexOf(tok);
            while (ei >= 0) { enRanges.push([ei, ei + tok.length]); ei = v.enL.indexOf(tok, ei + 1); }
            var ki = v.koL.indexOf(tok);
            while (ki >= 0) { koRanges.push([ki, ki + tok.length]); ki = v.koL.indexOf(tok, ki + 1); }
          } else if (tok.length >= 3) {
            var max = tok.length >= 5 ? 2 : 1; // 긴 낱말일수록 오타를 넉넉히 허용
            var nearEn = v.enWords.filter(function (x) { return Math.abs(x.w.length - tok.length) <= max && isNear(x.w, tok, max); });
            var nearKo = v.koWords.filter(function (x) { return Math.abs(x.w.length - tok.length) <= max && isNear(x.w, tok, max); });
            if (nearEn.length || nearKo.length) {
              s = 1; // 오타 보정 — 맞은 낱말을 통째로 강조
              nearEn.forEach(function (x) { enRanges.push([x.s, x.e]); });
              nearKo.forEach(function (x) { koRanges.push([x.s, x.e]); });
            }
          }
          if (!s) { matchedAll = false; break; }
          score += s;
        }
        if (matchedAll) hits.push({ v: v, score: score, enRanges: enRanges, koRanges: koRanges });
      }
      hits.sort(function (a, b) { return b.score - a.score || a.v.n - b.v.n; });
      hits = hits.slice(0, 30);
      if (!hits.length) {
        out.innerHTML = '<p class="search-note">찾는 게송이 없습니다. 다른 낱말로 다시 찾아 보세요. 한글 초성(예: ㅎㄴ)도 쓸 수 있습니다.</p>';
        return;
      }
      out.innerHTML = hits.map(function (h) {
        var v = h.v;
        var numLabel = v.nEnd !== v.n ? v.n + '–' + v.nEnd : String(v.n);
        return '<a class="search-hit" href="chapters/' + String(v.ch).padStart(2, '0') + '.html#v' + v.n + '">' +
          '<span class="hit-num">' + numLabel + '</span><span class="hit-ch">제' + v.ch + '품 ' + v.chKo + '</span>' +
          '<span class="hit-en" lang="en"></span><span class="hit-ko"></span></a>';
      }).join('');
      var nodes = out.querySelectorAll('.search-hit');
      hits.forEach(function (h, i) {
        nodes[i].querySelector('.hit-en').innerHTML = markUp(h.v.en, h.enRanges);
        nodes[i].querySelector('.hit-ko').innerHTML = markUp(h.v.ko, h.koRanges);
      });
    }

    input.addEventListener('input', function () { render(input.value); });
    render('');
  });
})();

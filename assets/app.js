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

  // ── 테마 (시스템 설정 자동 반영) ────────────────────────
  guard('theme', function () {
    if (!window.matchMedia) return;
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var apply = function () {
      document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
    };
    apply();
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  });

  // ── 영어 낭독 (speechSynthesis) ────────────────────────
  guard('tts', function () {
    if (!('speechSynthesis' in window)) return;

    function speak(text, btn) {
      window.speechSynthesis.cancel();
      document.querySelectorAll('[data-speaking="true"]').forEach(function (b) {
        b.removeAttribute('data-speaking');
      });
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.92;
      if (btn) {
        btn.setAttribute('data-speaking', 'true');
        u.onend = function () { btn.removeAttribute('data-speaking'); };
        u.onerror = function () { btn.removeAttribute('data-speaking'); };
      }
      window.speechSynthesis.speak(u);
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.tts-btn, [data-tts-all]') : null;
      if (!btn) return;
      if (btn.hasAttribute('data-tts-all')) {
        var verses = Array.prototype.map.call(
          btn.closest('.chapter').querySelectorAll('.verse-en'),
          function (p) { return p.textContent.trim(); }
        );
        speak(verses.join('. '), btn);
      } else {
        var art = btn.closest('.verse');
        var p = art && art.querySelector('.verse-en');
        if (p) speak(p.textContent.trim(), btn);
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

  // ── 홈: 게송 검색 ─────────────────────────────────────
  guard('search', function () {
    var input = document.getElementById('searchInput');
    var out = document.getElementById('searchResults');
    if (!input || !out || !window.DHP_INDEX) return;

    var flat = [];
    window.DHP_INDEX.forEach(function (ch) {
      ch.verses.forEach(function (v) {
        flat.push({ n: v.n, nEnd: v.nEnd, en: v.en, ko: v.ko, ch: ch.num, chKo: ch.ko });
      });
    });

    function render(q) {
      q = q.trim().toLowerCase();
      if (q.length < 1) {
        out.innerHTML = '<p class="search-note">단어나 문장을 입력하면 423게송에서 찾아 드립니다. (예: hatred, 행복, mind, shadow)</p>';
        return;
      }
      var hits = flat.filter(function (v) {
        return v.en.toLowerCase().indexOf(q) >= 0 || v.ko.indexOf(q) >= 0;
      }).slice(0, 30);
      if (!hits.length) {
        out.innerHTML = '<p class="search-note">찾는 게송이 없습니다. 다른 낱말로 다시 찾아 보세요.</p>';
        return;
      }
      out.innerHTML = hits.map(function (v) {
        var numLabel = v.nEnd !== v.n ? v.n + '–' + v.nEnd : String(v.n);
        return '<a class="search-hit" href="chapters/' + String(v.ch).padStart(2, '0') + '.html#v' + v.n + '">' +
          '<span class="hit-num">' + numLabel + '</span><span class="hit-ch">제' + v.ch + '품 ' + v.chKo + '</span>' +
          '<span class="hit-en" lang="en"></span><span class="hit-ko"></span></a>';
      }).join('');
      var nodes = out.querySelectorAll('.search-hit');
      hits.forEach(function (v, i) {
        nodes[i].querySelector('.hit-en').textContent = v.en;
        nodes[i].querySelector('.hit-ko').textContent = v.ko;
      });
    }

    input.addEventListener('input', function () { render(input.value); });
    render('');
  });
})();

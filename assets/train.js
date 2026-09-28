// 마음 단련 (수련 레벨) — 읽기·암송·낭독을 RPG식 수련으로 기록해
// 레벨·배지·연속 수련일로 매일의 독송을 동기로 이어 가게 합니다.
// 모든 기록은 방문자의 브라우저(localStorage)에만 있으며 서버로 전송하지 않습니다.
(function () {
  'use strict';

  var KEY = 'buddha.train';
  var DAY = 86400000;

  function guard(name, fn) {
    try { fn(); } catch (e) { console.warn('[' + name + '] 초기화 실패:', e); }
  }

  // ── 수련 레벨 — 누적 마음 단련(경험치) 기준 ────────────
  // 마지막 경지 「바라문」은 법구경 제26품 바라문품에서 따왔습니다.
  var LEVELS = [
    { lv: 1, xp: 0,    title: '입문자', sub: '수련의 문을 연 자' },
    { lv: 2, xp: 100,  title: '발심자', sub: '마음을 돌이킨 자' },
    { lv: 3, xp: 300,  title: '수행자', sub: '하루 한 걸음 익히는 자' },
    { lv: 4, xp: 700,  title: '정진자', sub: '놓치지 않고 이어 가는 자' },
    { lv: 5, xp: 1400, title: '선정자', sub: '고요히 마음을 모으는 자' },
    { lv: 6, xp: 2500, title: '반야자', sub: '있는 그대로 보는 자' },
    { lv: 7, xp: 4200, title: '견자',   sub: '이치를 꿰뚫어 본 자' },
    { lv: 8, xp: 6500, title: '아라한', sub: '괴로움을 다스린 자' },
    { lv: 9, xp: 9500, title: '바라문', sub: '참으로 고귀한 사람' },
  ];

  // ── 수련(경험치) — 하루 한 번씩 받도록 제한합니다 ──────
  var XP = {
    visit: 10,    // 하루 첫 방문
    daily: 5,     // 오늘의 법구 확인
    read: 5,      // 품 열어 읽기
    finish: 15,   // 품 완독 (끝까지 읽기)
    memorize: 5,  // 암송 모드 수련
    listen: 5,    // 영어 낭독 수련
    copy: 3,      // 인용 복사 (나누기)
  };

  // ── 배지 (업적) ────────────────────────────────────────
  var BADGES = [
    { id: 'first',     icon: '🌱', name: '첫걸음',     desc: '첫 마음 단련을 기록했습니다',            check: function (s) { return s.xp > 0; } },
    { id: 'streak3',   icon: '🔥', name: '3일 정진',   desc: '사흘 동안 한 번도 빠지지 않았습니다',    check: function (s) { return s.best >= 3; } },
    { id: 'streak7',   icon: '🔥', name: '7일 정진',   desc: '이레 동안 한 번도 빠지지 않았습니다',    check: function (s) { return s.best >= 7; } },
    { id: 'streak21',  icon: '🔥', name: '21일 정진',  desc: '세 주 동안 한 번도 빠지지 않았습니다',   check: function (s) { return s.best >= 21; } },
    { id: 'streak100', icon: '🌋', name: '100일 정진', desc: '백 일 동안 한 번도 빠지지 않았습니다',   check: function (s) { return s.best >= 100; } },
    { id: 'ch1',       icon: '📖', name: '첫 품 완독', desc: '첫 주 목표 — 한 품을 끝까지 읽었습니다', check: function (s) { return s.chaptersRead.length >= 1; } },
    { id: 'plan4',     icon: '🎋', name: '4주 완주',   desc: '첫 달 독송 목표를 달성했습니다',         check: function (s) { return s.chaptersRead.length >= 4; } },
    { id: 'plan13',    icon: '🌗', name: '13주 완주',  desc: '절반의 길 — 13주 목표를 달성했습니다',   check: function (s) { return s.chaptersRead.length >= 13; } },
    { id: 'plan26',    icon: '🏅', name: '26주 완주',  desc: '26주 독송 플랜을 완주했습니다',          check: function (s) { return s.chaptersRead.length >= 26; } },
    { id: 'memorize',  icon: '🧘', name: '암송 수련',  desc: '암송 모드로 첫 수련을 했습니다',          check: function (s) { return s.counters.memorize > 0; } },
    { id: 'listen',    icon: '👂', name: '낭독 수련',  desc: '영어 낭독을 처음 들었습니다',            check: function (s) { return s.counters.listen > 0; } },
    { id: 'copy',      icon: '🤝', name: '베풂',       desc: '게송 인용을 열 번 나눴습니다',            check: function (s) { return s.counters.copy >= 10; } },
    { id: 'daily7',    icon: '☀️', name: '아침의 법구', desc: '오늘의 법구를 일곱 날 확인했습니다',    check: function (s) { return s.counters.daily >= 7; } },
    { id: 'lv5',       icon: '⭐', name: '반야의 눈',  desc: '수련 레벨 5에 올랐습니다',               check: function (s) { return levelOf(s.xp).lv >= 5; } },
    { id: 'lv9',       icon: '👑', name: '바라문',     desc: '수련 레벨 9에 올랐습니다',               check: function (s) { return levelOf(s.xp).lv >= 9; } },
  ];

  // ── 날짜 · 상태 저장 ───────────────────────────────────
  function dayStr(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function today() { return dayStr(new Date()); }
  function yesterday() { return dayStr(new Date(Date.now() - DAY)); }

  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!s || typeof s !== 'object') s = {};
    return {
      xp: Number(s.xp) || 0,
      streak: Number(s.streak) || 0,
      best: Number(s.best) || 0,
      lastDay: s.lastDay || '',
      days: s.days && typeof s.days === 'object' ? s.days : {},
      chaptersRead: Array.isArray(s.chaptersRead) ? s.chaptersRead.slice() : [],
      caps: s.caps && typeof s.caps === 'object' ? s.caps : {},
      counters: {
        daily: Number(s.counters && s.counters.daily) || 0,
        listen: Number(s.counters && s.counters.listen) || 0,
        memorize: Number(s.counters && s.counters.memorize) || 0,
        copy: Number(s.counters && s.counters.copy) || 0,
        finish: Number(s.counters && s.counters.finish) || 0,
      },
      badges: Array.isArray(s.badges) ? s.badges.slice() : [],
    };
  }

  function save() {
    // 오래된 일일 제한 기록은 정리합니다
    var caps = state.caps;
    var keys = Object.keys(caps);
    if (keys.length > 200) {
      var keep = [today(), yesterday()];
      keys.forEach(function (k) { if (keep.indexOf(caps[k]) < 0) delete caps[k]; });
    }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function levelOf(xp) {
    var cur = LEVELS[0];
    for (var i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].xp) cur = LEVELS[i];
    var next = LEVELS[cur.lv] || null; // lv 는 1부터 시작하므로 인덱스와 같습니다
    var span = next ? next.xp - cur.xp : 1;
    return {
      lv: cur.lv,
      title: cur.title,
      sub: cur.sub,
      next: next,
      pct: next ? Math.min(100, Math.round(((xp - cur.xp) / span) * 100)) : 100,
      toNext: next ? next.xp - xp : 0,
    };
  }

  var state = load();

  // ── 토스트 (레벨 업 · 배지 알림) ───────────────────────
  var toastEl = null;
  var toastTimer = 0;
  function toast(msg, kind) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'train-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.className = 'train-toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'train-toast'; }, 2800);
  }

  // ── 수련 기록 (경험치·연속 수련일·배지) ───────────────
  function bump(key, xp, msg) {
    var t = today();
    var counted = false;
    // 카운터는 행동할 때마다, 경험치는 하루 한 번씩
    if (key === 'memorize') { state.counters.memorize += 1; counted = true; }
    else if (key === 'listen') { state.counters.listen += 1; counted = true; }
    else if (key === 'copy') { state.counters.copy += 1; counted = true; }
    if (state.caps[key] === t) { save(); renderAll(); return counted; }
    state.caps[key] = t;
    if (key === 'daily') state.counters.daily += 1;
    if (key.indexOf('finish:') === 0) state.counters.finish += 1;

    if (state.lastDay !== t) {
      state.streak = state.lastDay === yesterday() ? state.streak + 1 : 1;
      state.lastDay = t;
      if (state.streak > state.best) state.best = state.streak;
    }
    var beforeLv = levelOf(state.xp).lv;
    state.xp += xp;
    state.days[t] = (state.days[t] || 0) + xp;
    if (msg) toast(msg + ' +' + xp);
    settle(beforeLv);
    return true;
  }

  function settle(beforeLv) {
    BADGES.forEach(function (b) {
      if (state.badges.indexOf(b.id) >= 0) return;
      if (!b.check(state)) return;
      state.badges.push(b.id);
      state.xp += 20;
      state.days[today()] = (state.days[today()] || 0) + 20;
      toast('배지 획득! ' + b.icon + ' ' + b.name, 'badge');
    });
    var lv = levelOf(state.xp);
    if (beforeLv !== undefined && lv.lv > beforeLv) {
      toast('레벨 업! Lv.' + lv.lv + ' ' + lv.title, 'levelup');
      levelUpFx(lv);
    }
    save();
    renderAll();
  }

  // ── 레벨 업 축하 효과 (배너 · 빛 · 꽃잎) ─────────────
  function levelUpFx(lv) {
    if (!document.body) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var wrap = document.createElement('div');
    wrap.className = 'train-fx';
    wrap.setAttribute('aria-hidden', 'true');
    var petals = '';
    if (!reduce) {
      for (var i = 0; i < 16; i++) {
        petals += '<span class="train-fx-petal" style="left:' + Math.round(Math.random() * 100) +
          '%;animation-delay:' + (Math.random() * 0.7).toFixed(2) +
          's;animation-duration:' + (1.4 + Math.random() * 1.3).toFixed(2) + 's"></span>';
      }
    }
    wrap.innerHTML =
      '<div class="train-fx-glow"></div>' + petals +
      '<div class="train-fx-banner">' +
      '<span class="train-fx-kicker">레벨 업!</span>' +
      '<span class="train-fx-title">Lv.' + lv.lv + ' ' + lv.title + '</span>' +
      '<span class="train-fx-sub">' + lv.sub + '</span>' +
      '</div>';
    document.body.appendChild(wrap);
    setTimeout(function () { wrap.classList.add('show'); }, 20);
    setTimeout(function () { wrap.classList.remove('show'); }, reduce ? 1300 : 2300);
    setTimeout(function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, reduce ? 2000 : 3100);
  }

  // ── 주차 완주 보상 — 26주 독송 플랜 연동 ──────────────
  // 주차 N 은 제N품 과 1:1 로 이어지며, 해당 품을 처음 완독하면 한 번 받습니다.
  function weekReward(week) {
    var beforeLv = levelOf(state.xp).lv;
    state.xp += 20;
    state.days[today()] = (state.days[today()] || 0) + 20;
    toast(week + '주 완주 보상 +20', 'badge');
    settle(beforeLv);
  }

  // ── 화면 — 홈 수련 현황 ───────────────────────────────
  function renderMini() {
    var el = document.getElementById('trainMini');
    if (!el) return;
    var lv = levelOf(state.xp);
    el.innerHTML =
      '<a class="train-mini" href="#training">' +
      '<span class="train-mini-lv">수련 Lv.' + lv.lv + ' ' + lv.title + '</span>' +
      '<span class="train-bar" aria-hidden="true"><i style="width:' + lv.pct + '%"></i></span>' +
      '<span class="train-mini-xp">마음 단련 ' + state.xp + (lv.next ? ' · 다음 레벨까지 ' + lv.toNext : '') + '</span>' +
      (state.streak > 0 ? '<span class="train-mini-streak">연속 수련 ' + state.streak + '일</span>' : '') +
      '</a>';
  }

  // ── 화면 — 홈 수련 패널 ───────────────────────────────
  function renderPanel() {
    var el = document.getElementById('trainPanel');
    if (!el) return;
    var lv = levelOf(state.xp);
    var days = [];
    for (var i = 13; i >= 0; i--) {
      var d = dayStr(new Date(Date.now() - i * DAY));
      days.push('<span class="train-day' + (state.days[d] ? ' on' : '') + '"></span>');
    }
    var t = today();
    function doneToday(key) { return state.caps[key] === t; }
    function anyReadToday() {
      var keys = Object.keys(state.caps);
      for (var j = 0; j < keys.length; j++) {
        if (keys[j].indexOf('read:') === 0 && state.caps[keys[j]] === t) return true;
      }
      return false;
    }
    var quests = [
      { label: '오늘 수련 시작',    xp: XP.visit,    done: doneToday('visit') },
      { label: '오늘의 법구 확인',  xp: XP.daily,    done: doneToday('daily') },
      { label: '한 품 읽기',        xp: XP.read,     done: anyReadToday() },
      { label: '암송 모드 수련',    xp: XP.memorize, done: doneToday('memorize') },
      { label: '영어 낭독 수련',    xp: XP.listen,   done: doneToday('listen') },
      { label: '게송 인용 나누기',  xp: XP.copy,     done: doneToday('copy') },
    ].map(function (q) {
      return '<div class="train-quest' + (q.done ? ' done' : '') + '">' +
        '<span class="train-quest-mark" aria-hidden="true">' + (q.done ? '✓' : '○') + '</span>' +
        '<span class="train-quest-label">' + q.label + '</span>' +
        '<span class="train-quest-xp">+' + q.xp + '</span></div>';
    }).join('');
    var badges = BADGES.map(function (b) {
      var got = state.badges.indexOf(b.id) >= 0;
      return '<div class="train-badge' + (got ? '' : ' locked') + '">' +
        '<span class="train-badge-icon" aria-hidden="true">' + b.icon + '</span>' +
        '<span><b>' + b.name + '</b><span>' + b.desc + '</span></span></div>';
    }).join('');
    el.innerHTML =
      '<div class="train-level">' +
        '<div class="train-medal" aria-hidden="true">' + lv.lv + '</div>' +
        '<div class="train-level-main">' +
          '<p class="train-level-title"><span class="lv">Lv.' + lv.lv + '</span>' + lv.title + '</p>' +
          '<p class="train-level-sub">' + lv.sub + '</p>' +
          '<span class="train-bar train-bar-lg" aria-hidden="true"><i style="width:' + lv.pct + '%"></i></span>' +
          '<p class="train-xp-note">마음 단련 ' + state.xp + (lv.next ? ' · 다음 레벨(' + lv.next.title + ')까지 ' + lv.toNext + ' 남음' : ' · 최고 경지에 이르렀습니다') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="train-stats">' +
        '<div class="train-stat"><b>' + state.xp + '</b><span>누적 마음 단련</span></div>' +
        '<div class="train-stat"><b>' + state.streak + '일</b><span>연속 수련</span></div>' +
        '<div class="train-stat"><b>' + state.best + '일</b><span>최장 연속 수련</span></div>' +
        '<div class="train-stat"><b>' + state.chaptersRead.length + ' / 26</b><span>완독한 품</span></div>' +
        '<div class="train-stat"><b>' + (state.days[today()] || 0) + '</b><span>오늘의 단련</span></div>' +
      '</div>' +
      '<div>' +
        '<p class="train-xp-note">오늘의 수련 과제 — 하루 한 번씩 마음 단련을 받습니다</p>' +
        '<div class="train-quests">' + quests + '</div>' +
      '</div>' +
      '<div>' +
        '<p class="train-xp-note">최근 14일 수련 기록</p>' +
        '<div class="train-cal" aria-label="최근 14일 수련 기록">' + days.join('') + '</div>' +
      '</div>' +
      '<div>' +
        '<p class="train-xp-note">배지 ' + state.badges.length + ' / ' + BADGES.length + '</p>' +
        '<div class="train-badges">' + badges + '</div>' +
      '</div>' +
      '<div class="train-actions">' +
        '<button class="btn btn-ghost" type="button" data-train-export>기록 내보내기</button>' +
        '<button class="btn btn-ghost" type="button" data-train-import>기록 가져오기</button>' +
        '<button class="btn btn-ghost" type="button" data-train-reset>처음부터</button>' +
      '</div>' +
      '<p class="train-note">수련 기록은 이 기기(브라우저)에만 저장되며 서버로 전송하지 않습니다. 기기를 바꿀 때는 기록 내보내기·가져오기를 이용하세요.</p>';
  }

  // ── 화면 — 챕터 페이지 수련 스트립 ─────────────────────
  function renderStrip() {
    var el = document.getElementById('trainStrip');
    if (!el) return;
    var ch = chapterNum();
    if (!ch) return;
    var lv = levelOf(state.xp);
    var read = state.chaptersRead.indexOf(ch) >= 0;
    el.innerHTML =
      '<div class="train-strip">' +
      '<span class="train-strip-lv">수련 Lv.' + lv.lv + ' ' + lv.title + '</span>' +
      '<span class="train-bar" aria-hidden="true"><i style="width:' + lv.pct + '%"></i></span>' +
      (read
        ? '<span class="train-strip-done">제' + ch + '품 완독 ✓</span>'
        : '<span class="train-strip-hint">끝까지 읽으면 제' + ch + '품 완독 · 마음 단련 +' + XP.finish + ' · 첫 완독 시 ' + ch + '주 보상 +20</span>') +
      '</div>';
  }

  // ── 화면 — 26주 독송 플랜 주차별 목표 ─────────────────
  function renderPlan() {
    var el = document.getElementById('planTrain');
    if (!el) return;
    var doneCount = 0;
    var current = 0;
    for (var n = 1; n <= 26; n++) {
      if (state.chaptersRead.indexOf(n) >= 0) doneCount++;
      else if (!current) current = n;
    }
    if (!current) current = 26;
    var pct = Math.round((doneCount / 26) * 100);
    el.innerHTML =
      '<p class="plan-train-title">독송 플랜 수련 현황 — ' + doneCount + ' / 26주 완료</p>' +
      '<span class="train-bar train-bar-lg" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' +
      (doneCount >= 26
        ? '<p class="plan-train-goal"><b>26주 완주!</b> 모든 품을 완독했습니다. 두 번째 독송으로 이어 가세요.</p>'
        : '<p class="plan-train-goal">이번 주 목표 — <b>제' + current + '품 완독</b> · 끝까지 읽으면 마음 단련 +20(완독 +15 · 첫 완독 주차 보상 +20)</p>') +
      '<p class="train-note">주차별 목표는 각 품을 끝까지 읽으면 완료됩니다. 완주 보상 배지 — 4주 🎋 · 13주 🌗 · 26주 🏅</p>';

    // 주차 목록에 완료 · 이번 주 표시
    var items = document.querySelectorAll('.week-item[data-week]');
    for (var i = 0; i < items.length; i++) {
      var li = items[i];
      var w = Number(li.getAttribute('data-week'));
      var done = state.chaptersRead.indexOf(w) >= 0;
      var isCurrent = !done && w === current;
      li.classList.toggle('done', done);
      li.classList.toggle('current', isCurrent);
      var chip = li.querySelector('.week-chip');
      if (!chip) {
        chip = document.createElement('span');
        chip.className = 'week-chip';
        li.appendChild(chip);
      }
      chip.className = 'week-chip' + (done ? ' done' : isCurrent ? ' current' : ' hide');
      chip.textContent = done ? '완료 ✓' : isCurrent ? '이번 주 ▶' : '';
    }
  }

  // ── 화면 — 목차 완독 표시 ─────────────────────────────
  function renderToc() {
    var grid = document.getElementById('tocGrid');
    if (!grid) return;
    var items = grid.querySelectorAll('.toc-item');
    for (var i = 0; i < items.length; i++) {
      var a = items[i];
      var m = (a.getAttribute('href') || '').match(/chapters\/(\d{2})\.html/);
      if (!m) continue;
      var done = state.chaptersRead.indexOf(Number(m[1])) >= 0;
      if (done && !a.querySelector('.toc-check')) {
        var s = document.createElement('span');
        s.className = 'toc-check';
        s.setAttribute('aria-label', '완독');
        s.textContent = '✓';
        a.appendChild(s);
      }
    }
  }

  function renderAll() {
    renderMini();
    renderPanel();
    renderStrip();
    renderPlan();
    renderToc();
  }

  function chapterNum() {
    var m = location.pathname.match(/(\d{2})\.html/);
    return m ? Number(m[1]) : 0;
  }

  // ── 기록 내보내기 · 가져오기 · 초기화 ──────────────────
  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'buddha-train-' + today() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('수련 기록을 내보냈습니다');
  }

  function importData() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          merge(JSON.parse(String(reader.result)));
          settle();
          toast('수련 기록을 가져왔습니다');
        } catch (e) {
          toast('기록 파일을 읽지 못했습니다');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  function merge(data) {
    if (!data || typeof data !== 'object') throw new Error('형식 오류');
    state.xp = Math.max(state.xp, Number(data.xp) || 0);
    state.best = Math.max(state.best, Number(data.best) || 0);
    if ((Number(data.streak) || 0) > state.streak && (data.lastDay === today() || data.lastDay === yesterday())) {
      state.streak = Number(data.streak);
      state.lastDay = data.lastDay;
    }
    if (data.days) {
      Object.keys(data.days).forEach(function (d) {
        state.days[d] = Math.max(state.days[d] || 0, Number(data.days[d]) || 0);
      });
    }
    if (Array.isArray(data.chaptersRead)) {
      data.chaptersRead.forEach(function (c) {
        c = Number(c);
        if (c >= 1 && c <= 26 && state.chaptersRead.indexOf(c) < 0) state.chaptersRead.push(c);
      });
    }
    if (data.counters) {
      Object.keys(state.counters).forEach(function (k) {
        state.counters[k] = Math.max(state.counters[k], Number(data.counters[k]) || 0);
      });
    }
    // 배지는 합집합으로 — 이미 가진 배지는 다시 주지 않으므로 경험치가 중복되지 않습니다
    if (Array.isArray(data.badges)) {
      data.badges.forEach(function (b) {
        var known = BADGES.some(function (x) { return x.id === b; });
        if (known && state.badges.indexOf(b) < 0) state.badges.push(b);
      });
    }
    // 일일 제한 기록은 더 최근 날짜를 따릅니다 (YYYY-MM-DD 는 문자열 비교로 충분)
    if (data.caps && typeof data.caps === 'object') {
      Object.keys(data.caps).forEach(function (k) {
        var v = String(data.caps[k] || '');
        if (/^\d{4}-\d{2}-\d{2}$/.test(v) && (!state.caps[k] || v > state.caps[k])) state.caps[k] = v;
      });
    }
  }

  function resetData() {
    if (!window.confirm('수련 기록을 모두 지우고 처음부터 시작할까요? 되돌릴 수 없습니다.')) return;
    try { localStorage.removeItem(KEY); } catch (e) {}
    state = load();
    settle();
    toast('수련 기록을 처음부터 시작합니다');
  }

  // ── 수련 행동 감지 ─────────────────────────────────────
  guard('train-actions', function () {
    // 하루 첫 방문
    bump('visit', XP.visit, '오늘의 수련 시작');

    document.addEventListener('click', function (e) {
      if (!e.target.closest) return;
      var btn = e.target.closest('[data-memorize-toggle], .tts-btn, [data-tts-all], [data-copy], [data-train-export], [data-train-import], [data-train-reset]');
      if (btn) {
        if (btn.hasAttribute('data-memorize-toggle')) bump('memorize', XP.memorize, '암송 수련');
        else if (btn.hasAttribute('data-copy')) bump('copy', XP.copy, '베풂 — 인용 나누기');
        else if (btn.hasAttribute('data-train-export')) exportData();
        else if (btn.hasAttribute('data-train-import')) importData();
        else if (btn.hasAttribute('data-train-reset')) resetData();
        else bump('listen', XP.listen, '영어 낭독 수련');
        return;
      }
      var daily = e.target.closest('#dailyVerse a');
      if (daily) bump('daily', XP.daily, '오늘의 법구 확인');
    });

    // 챕터 페이지 — 품 열기 + 끝까지 읽으면 완독
    var ch = chapterNum();
    if (ch && document.querySelector('.verse[data-verse]')) {
      bump('read:' + ch, XP.read, '제' + ch + '품 수련 시작');
      var done = false;
      var onScroll = function () {
        if (done) return;
        var h = document.documentElement.scrollHeight - window.innerHeight;
        if (h <= 0 || window.scrollY < h * 0.9) return;
        done = true;
        window.removeEventListener('scroll', onScroll);
        var firstTime = state.chaptersRead.indexOf(ch) < 0;
        if (firstTime) state.chaptersRead.push(ch);
        bump('finish:' + ch, XP.finish, '제' + ch + '품 완독');
        if (firstTime) weekReward(ch);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
    }
  });

  guard('train-render', renderAll);
})();

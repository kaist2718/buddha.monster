// 방문 분석 (자체 호스팅) — 쿠키를 쓰지 않아 동의 배너가 필요 없습니다.
// 수집 서버 주소와 사이트 ID는 이 파일 한 곳에서 정합니다.
// 자세한 내용은 README 의 "방문 분석" 항목을 보세요.
(function () {
  try {
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://visitor-analytics-a5bp.onrender.com/analytics.js';
    s.setAttribute('data-domain', 'buddha.monster');
    document.head.appendChild(s);
  } catch (e) {}
})();

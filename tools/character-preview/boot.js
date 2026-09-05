import('./viewer.js').catch(() => {
  document.querySelector('#status').textContent = '3D 도구를 불러오지 못했습니다. 로컬 vendor 준비 상태를 확인해주세요.';
  document.querySelector('#fallback-reason').textContent = '정적 대체 화면입니다. 제품 기록·조회에는 영향을 주지 않습니다.';
});

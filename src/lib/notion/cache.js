// 아주 단순한 서버 메모리 TTL 캐시. 포트폴리오 화면을 열 때마다 노션 API를
// 매번 새로 부르지 않도록, 짧은 시간(기본 호출부에서 지정) 동안은 이전 결과를 재사용한다.
// (같은 서버 프로세스 안에서만 유지된다. Vercel 서버리스 환경에서는 함수 인스턴스가
// 재사용될 때만 효과가 있고, 그 이상 정교한 공유 캐시가 필요해지면 그때 확장한다.)
const store = new Map();

export async function cached(key, ttlMs, fn, { force = false } = {}) {
  const now = Date.now();

  if (!force) {
    const hit = store.get(key);
    if (hit && now - hit.time < ttlMs) {
      return hit.value;
    }
  }

  const value = await fn();
  store.set(key, { value, time: now });
  return value;
}

/** 웹: 브라우저 localStorage (새 패키지 필요 없음). 사생활 보호 모드 등에서 막히면 조용히 무시 */
export async function load<T>(key: string): Promise<T | null> {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
export async function save(key: string, value: unknown): Promise<void> {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 공간이 꽉 찼거나 막힘 → 기록만 안 남음 */
  }
}

/**
 * 앱이 서버를 부르는 곳은 이 파일 하나뿐.
 * EXPO_PUBLIC_API_URL 이 비어 있으면 목업으로 동작하고, 있으면 우리 Lambda 를 부른다.
 *
 * ⚠️ 공공데이터포털 API 와 인증키는 앱에서 직접 쓰지 않는다.
 *   앱 안의 값은 누구나 꺼내 볼 수 있다. 인증키는 Lambda 환경 변수에만 둔다.
 *   수집 기능이 주기적으로 받아 DB(Supabase PostgreSQL)에 저장하고, 앱은 우리 API 만 부른다.
 *
 * 우리 API (Lambda) 약속
 *   GET  /items?keyword=&category=&source=&days=&photo=&page=&size=  → ListPage (30건씩)
 *   GET  /items/detail?atcId=&fdSn=                → FoundItemDetail
 *   GET  /stats                                    → { total, today }
 *   GET  /me                                       → { user, myItems, lost, notices }   (로그인 후)
 *   POST /chat   ChatRequest                       → ChatReply
 *   POST /auth/login {email, password, name}       → { token, user }   (처음 보는 이메일이면 가입)
 *   POST /me/notices/read · POST /lost/found {id}
 */
import { MOCK_ITEMS } from "./mock-data";
import { mockChat } from "./mock-chat";
import { hasPhoto, localYmd } from "./format";
import type { ChatReply, ChatRequest, FoundItem, FoundItemDetail, ListPage, ListQuery, MyData, Stats, User } from "./types";

const API = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
export const IS_MOCK = !API;

/** 로그인 토큰 (로그인하면 저장, 요청마다 Authorization 헤더로 보냄) */
let token: string | null = null;
export const setToken = (t: string | null) => {
  token = t;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
    });
  } catch {
    throw new Error("인터넷 연결을 확인해 주세요.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "잠시 후 다시 시도해 주세요.");
  return data as T;
}

export async function listItems(q: ListQuery = {}): Promise<ListPage> {
  const page = q.page ?? 1;
  const size = q.size ?? 30;
  if (IS_MOCK) {
    await new Promise((r) => setTimeout(r, 250));
    const since = q.days ? Date.now() - q.days * 86400000 : 0;
    // 검색어를 띄어쓰기로 나눠서 모든 단어가 어딘가에 들어 있으면 보여 준다 ("검정 지갑")
    const words = (q.keyword || "").trim().split(/\s+/).filter(Boolean);
    const hit = (it: FoundItem) =>
      words.every((w) => [it.fdPrdtNm, it.prdtClNm, it.clrNm, it.fdSbjt, it.depPlace, it.foundPlace, ...(it.features ?? [])].some((v) => v?.includes(w)));
    const base = MOCK_ITEMS.filter(
      (it) =>
        (!q.source || q.source === "all" || it.source === q.source) &&
        (!since || new Date(it.fdYmd).getTime() >= since - 86400000) &&
        (!q.photo || hasPhoto(it.fdFilePathImg)) &&
        hit(it),
    );
    const counts: Record<string, number> = {};
    for (const it of base) {
      const c = it.prdtClNm.split(">")[0].trim();
      counts[c] = (counts[c] ?? 0) + 1;
    }
    const all = base.filter((it) => !q.category || it.prdtClNm.startsWith(q.category));
    return { items: all.slice((page - 1) * size, page * size), page, hasMore: all.length > page * size, total: all.length, counts };
  }
  const params = Object.entries({ ...q, page, size })
    .filter(([k, v]) => v !== undefined && v !== "" && !(k === "source" && v === "all"))
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return call<ListPage>(`/items?${params}`);
}

/** 홈 화면 숫자: 보관 중인 습득물 수, 오늘 들어온 수 */
export async function getStats(): Promise<Stats> {
  if (IS_MOCK) {
    const today = localYmd();
    const live = MOCK_ITEMS.filter((it) => it.status === "보관중" || it.status === "현장에 있음");
    return { total: live.length, today: MOCK_ITEMS.filter((it) => it.fdYmd === today).length };
  }
  return call<Stats>("/stats");
}

export async function getItem(atcId: string, fdSn: string): Promise<FoundItemDetail | null> {
  if (IS_MOCK) return MOCK_ITEMS.find((it) => it.atcId === atcId && it.fdSn === fdSn) ?? null;
  return call<FoundItemDetail>(`/items/detail?atcId=${encodeURIComponent(atcId)}&fdSn=${encodeURIComponent(fdSn)}`);
}

export async function sendChat(req: ChatRequest): Promise<ChatReply> {
  if (IS_MOCK) return mockChat(req);
  // 사진은 uri 가 아니라 base64 로 보낸다 (서버가 S3 에 저장하고 Bedrock 으로 분석)
  const image = req.image?.base64 ? { name: req.image.name, base64: req.image.base64 } : undefined;
  return call<ChatReply>("/chat", { method: "POST", body: JSON.stringify({ ...req, image }) });
}

/* ───── 로그인 · 마이페이지 (서버 모드에서만 부름. 목업은 store.ts 가 처리) ───── */
export const apiLogin = (email: string, password: string, name: string) =>
  call<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, name }) });
export const apiMe = () => call<MyData>("/me");
export const apiReadNotices = () => call<{ ok: boolean }>("/me/notices/read", { method: "POST", body: "{}" });
export const apiLostFound = (id: string) => call<{ ok: boolean }>("/lost/found", { method: "POST", body: JSON.stringify({ id }) });

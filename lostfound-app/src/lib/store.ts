/**
 * 앱 안에서 기억하는 값: 로그인한 사용자, 내가 등록한 습득물, 잃어버린 물건, 알림.
 *
 * 서버 모드(EXPO_PUBLIC_API_URL 있음): 값은 DB 에 있고, refreshMe() 가 GET /me 로 가져와서 화면에 보여 준다.
 * 목업 모드: 앱을 끄면 사라지는 메모리 저장 (mock-chat.ts 가 addFoundItem / addLost 를 부른다).
 */
import { useSyncExternalStore } from "react";
import { apiLogin, apiSignup, apiLostFound, apiMe, apiReadNotices, IS_MOCK, setToken } from "./api";
import { MOCK_ITEMS } from "./mock-data";
import { loadSession, saveSession } from "./session";
import type { FoundItem, LostItem, Notice, SignupForm, User } from "./types";

interface AppState {
  user: User | null;
  myItems: FoundItem[]; // 내가 등록한 습득물
  lost: LostItem[]; // 내가 잃어버린 물건 (matches 포함)
  notices: Notice[];
  version: number; // 습득물이 바뀔 때마다 +1 (홈 숫자·목록 새로 고침용)
  meError: string; // 마이페이지를 못 불러왔을 때 이유 (조용히 넘기지 않고 화면에 보여 준다)
}

let state: AppState = { user: null, myItems: [], lost: [], notices: [], version: 0, meError: "" };
const listeners = new Set<() => void>();

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useApp<T>(pick: (s: AppState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pick(state),
    () => pick(state),
  );
}
export const getApp = () => state;

/* ───── 로그인 · 회원가입 ───── */
async function signedIn(token: string, user: User) {
  setToken(token);
  set({ user });
  await saveSession({ token, user }); // 앱을 다시 켜도 로그인 유지
  await refreshMe();
}

export async function login(loginId: string, password: string) {
  if (IS_MOCK) {
    set({ user: { id: `u-${loginId}`, name: loginId, loginId } });
    return;
  }
  const r = await apiLogin(loginId.trim(), password);
  await signedIn(r.token, r.user);
}

export async function signup(f: SignupForm) {
  if (IS_MOCK) {
    set({ user: { id: `u-${f.loginId}`, name: f.nickname, loginId: f.loginId } });
    return;
  }
  const r = await apiSignup({ ...f, nickname: f.nickname.trim(), loginId: f.loginId.trim().toLowerCase() });
  await signedIn(r.token, r.user);
}

export function logout() {
  setToken(null);
  saveSession(null);
  set({ user: null, myItems: [], lost: [], notices: [] });
}

/** 앱을 켤 때 한 번: 저장해 둔 로그인이 있으면 이어서 (토큰이 만료됐으면 refreshMe 가 로그아웃) */
export async function restoreSession() {
  if (IS_MOCK || state.user) return;
  const s = await loadSession();
  if (!s) return;
  setToken(s.token);
  set({ user: s.user });
  await refreshMe();
}

/** 서버에서 마이페이지 데이터 새로 가져오기 (챗봇 등록 뒤, 화면에 들어올 때) */
export async function refreshMe() {
  if (IS_MOCK || !state.user) return;
  try {
    const me = await apiMe();
    set({ user: me.user, myItems: me.myItems, lost: me.lost, notices: me.notices, version: state.version + 1, meError: "" });
  } catch (e) {
    const msg = String((e as Error).message);
    if (msg.includes("로그인이 필요")) return logout(); // 토큰이 만료·위조
    set({ meError: msg }); // 그 밖의 에러는 마이페이지에 보여 준다
  }
}

export async function markLostFound(id: string) {
  if (!IS_MOCK) {
    await apiLostFound(id);
    return refreshMe();
  }
  set({ lost: state.lost.map((l) => (l.id === id ? { ...l, status: "찾음" } : l)) });
}

export async function readAllNotices() {
  if (!IS_MOCK) {
    await apiReadNotices().catch(() => {});
    return refreshMe();
  }
  set({ notices: state.notices.map((n) => ({ ...n, read: true })) });
}

/* ───── 아래는 목업 모드 전용 (실제로는 서버의 chat.py · matching.py 가 한다) ───── */

/** 습득물 등록 → 잃어버린 물건과 비교해서 알림 */
export function addFoundItem(item: FoundItem) {
  MOCK_ITEMS.unshift({
    ...item,
    sightings: [{ at: new Date().toISOString(), foundPlace: item.foundPlace ?? item.depPlace, currentPlace: item.currentPlace ?? item.depPlace, note: item.fdSbjt }],
  });
  const notices = [...state.notices];
  const lost = state.lost.map((l) => {
    if (l.status !== "찾는 중" || !isSimilar(l, item)) return l;
    notices.unshift({
      id: `n${Date.now()}${l.id}`,
      at: new Date().toISOString(),
      lostId: l.id,
      itemId: item.atcId,
      text: `잃어버린 ‘${l.color} ${l.kind}’과 비슷한 물건이 등록됐어요. 지금 위치: ${item.currentPlace ?? item.depPlace}`,
      read: false,
    });
    return { ...l, matchIds: [item.atcId, ...l.matchIds], matches: [item, ...(l.matches ?? [])] };
  });
  set({ myItems: state.user ? [item, ...state.myItems] : state.myItems, lost, notices, version: state.version + 1 });
}

/** 같은 종류 + (색이 같거나 특징이 겹치면) 비슷하다고 본다. 서버는 이미지 임베딩 + 위치 거리까지 본다 */
export function isSimilar(l: Pick<LostItem, "category" | "color" | "features">, it: FoundItem): boolean {
  if (!it.prdtClNm.startsWith(l.category)) return false;
  const color = !!it.clrNm && !!l.color && (it.clrNm.includes(l.color) || l.color.includes(it.clrNm.split("(")[0]));
  const feature = l.features.some((f) => (it.features ?? []).some((g) => g.includes(f) || f.includes(g)) || it.fdSbjt.includes(f));
  return color || feature;
}

/** 잃어버린 물건 등록 */
export function addLost(l: Omit<LostItem, "id" | "createdAt" | "status" | "matchIds">, matchIds: string[]): LostItem {
  const item: LostItem = {
    ...l,
    id: `L${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "찾는 중",
    matchIds,
    matches: MOCK_ITEMS.filter((it) => matchIds.includes(it.atcId)),
  };
  set({ lost: [item, ...state.lost] });
  return item;
}

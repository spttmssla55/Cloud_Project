/**
 * 앱 안에서 기억하는 값: 로그인한 사용자, 내가 등록한 습득물, 잃어버린 물건, 알림.
 *
 * 지금(목업)은 앱을 끄면 사라지는 메모리 저장이다.
 * 서버를 연결하면 이 값들은 DynamoDB 에 저장되고, 앱은 화면에 보여 주기만 한다.
 *   - 내가 등록한 습득물: ITEM#<id> 의 reporterId = 내 id
 *   - 잃어버린 물건:     REQ#<내 id> / <시각>
 *   - 알림:             새 습득물이 등록될 때 서버(매칭 Lambda)가 REQ 와 비교해서 만든다 → 푸시 알림
 */
import { useSyncExternalStore } from "react";
import { MOCK_ITEMS } from "./mock-data";
import type { FoundItem, LostItem, Notice, User } from "./types";

interface AppState {
  user: User | null;
  myFoundIds: string[]; // 내가 등록한 습득물 atcId
  lost: LostItem[]; // 내가 잃어버린 물건
  notices: Notice[];
  version: number; // 습득물 목록이 바뀔 때마다 +1 (화면 새로 고침용)
}

let state: AppState = { user: null, myFoundIds: [], lost: [], notices: [], version: 0 };
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

/* ───── 로그인 (지금은 예시: 이름·이메일만 받음) ───── */
export function login(name: string, email: string) {
  set({ user: { id: `u-${email.toLowerCase()}`, name: name.trim() || email.split("@")[0], email: email.trim() } });
}
export function logout() {
  set({ user: null });
}

/* ───── 습득물 등록 → 잃어버린 물건과 비교해서 알림 ───── */
export function addFoundItem(item: FoundItem) {
  MOCK_ITEMS.unshift({ ...item, sightings: [{ at: new Date().toISOString(), foundPlace: item.foundPlace ?? item.depPlace, currentPlace: item.currentPlace ?? item.depPlace, note: item.fdSbjt }] });
  const mine = state.user ? [item.atcId, ...state.myFoundIds] : state.myFoundIds;
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
    return { ...l, matchIds: [item.atcId, ...l.matchIds] };
  });
  set({ myFoundIds: mine, lost, notices, version: state.version + 1 });
}

/** 같은 종류 + (색이 같거나 특징이 겹치면) 비슷하다고 본다. 실제로는 이미지 임베딩 + 위치 거리 */
export function isSimilar(l: Pick<LostItem, "category" | "color" | "features">, it: FoundItem): boolean {
  if (!it.prdtClNm.startsWith(l.category)) return false;
  const color = !!it.clrNm && (it.clrNm.includes(l.color) || l.color.includes(it.clrNm.split("(")[0]));
  const feature = l.features.some((f) => (it.features ?? []).some((g) => g.includes(f) || f.includes(g)) || it.fdSbjt.includes(f));
  return color || feature;
}

/* ───── 잃어버린 물건 등록 ───── */
export function addLost(l: Omit<LostItem, "id" | "createdAt" | "status" | "matchIds">, matchIds: string[]): LostItem {
  const item: LostItem = { ...l, id: `L${Date.now()}`, createdAt: new Date().toISOString(), status: "찾는 중", matchIds };
  set({ lost: [item, ...state.lost] });
  return item;
}
export function markLostFound(id: string) {
  set({ lost: state.lost.map((l) => (l.id === id ? { ...l, status: "찾음" } : l)) });
}
export function readAllNotices() {
  set({ notices: state.notices.map((n) => ({ ...n, read: true })) });
}

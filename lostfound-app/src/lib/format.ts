import type { Source, Status } from "./types";

export const SOURCE_LABEL: Record<Source, string> = {
  portal: "지하철·공항·쇼핑몰",
  police: "경찰서",
  user: "사용자 제보",
};

/** 내 휴대폰 시간대 기준 YYYY-MM-DD (toISOString 은 UTC 라 한국에서는 새벽에 하루 밀린다) */
export function localYmd(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 2026-10-27 → "오늘" / "어제" / "3일 전" / "10월 25일" */
export function relDate(ymd: string): string {
  const [y, m, dd] = ymd.slice(0, 10).split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff > 1 && diff < 7) return `${diff}일 전`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function timeText(iso: string): string {
  const d = new Date(iso);
  return `${relDate(localYmd(d))} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 대분류마다 기본 그림 (사진이 없을 때) — 경찰청 물품분류 기준 */
const CAT_EMOJI = {
  지갑: "👛", 휴대폰: "📱", 전자기기: "🎧", 컴퓨터: "💻", 카드: "💳", 증명서: "🛂", 가방: "🎒", 우산: "☂️",
  의류: "👕", 귀금속: "💍", 현금: "💵", 유가증권: "🧾", 서류: "📄", 도서용품: "📚", 쇼핑백: "🛍️",
  스포츠용품: "⚽", 악기: "🎸", 산업용품: "🧰", 자동차: "🔑", 기타물품: "📦", 기타: "📦", 유류품: "🧳", 무주물: "📦",
};
export function categoryEmoji(prdtClNm: string): string {
  const c = prdtClNm.split(">")[0].trim();
  return (CAT_EMOJI as Record<string, string>)[c] ?? "📦";
}

/** 공공 API 의 "사진 없음" 기본 그림은 사진으로 치지 않는다 */
export function hasPhoto(url?: string): url is string {
  return !!url && !/no_img/.test(url);
}

export type { Status };

/**
 * 보관 기한: 경찰서·기관에 맡겨진 습득물은 공고 후 6개월 안에 주인이 찾아가야 한다 (민법 253조).
 * 공고일은 API 에 없어서 습득일 + 6개월로 '대략' 계산한다 (실제 기한은 며칠 더 늦을 수 있음 → 안전한 쪽).
 * 사용자 제보 물건은 법적 보관이 아니라서 기한 없음.
 */
export function deadlineOf(item: { source: Source; fdYmd: string }): { date: string; left: number } | null {
  if (item.source === "user" || !item.fdYmd) return null;
  const [y, m, d] = item.fdYmd.slice(0, 10).split("-").map(Number);
  const end = new Date(y, m - 1 + 6, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return { date: localYmd(end), left: Math.round((end.getTime() - today.getTime()) / 86400000) };
}

/** D-23 / D-DAY / 기한 지남 */
export function ddayText(left: number): string {
  if (left < 0) return "기한 지남";
  if (left === 0) return "D-DAY";
  return `D-${left}`;
}

/** 경찰서·유실물센터 운영 시간 (API 에 없어서 일반 기준) */
export const OFFICE_HOURS = "평일 09:00~18:00 (점심 12:00~13:00 · 주말·공휴일 휴무, 지구대는 24시간)";

/** 카카오맵 길찾기 (앱이 있으면 앱, 없으면 웹) — 무료, 키 필요 없음 */
export function directionsUrl(name: string, lat: number, lng: number): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(name.replace(/,/g, " "))},${lat},${lng}`;
}

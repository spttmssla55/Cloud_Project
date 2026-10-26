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

/** 대분류마다 기본 그림 (사진이 없을 때) */
export function categoryEmoji(prdtClNm: string): string {
  const c = prdtClNm.split(">")[0].trim();
  return ({ 지갑: "👛", 휴대폰: "📱", 전자기기: "🎧", 카드: "💳", 증명서: "🛂", 가방: "🎒", 우산: "☂️" } as Record<string, string>)[c] ?? "📦";
}

/** 공공 API 의 "사진 없음" 기본 그림은 사진으로 치지 않는다 */
export function hasPhoto(url?: string): url is string {
  return !!url && !/no_img/.test(url);
}

export type { Status };

/**
 * 색과 글자 크기는 여기 한 곳에서 정한다.
 * 가독성 기준: 본문 17, 진한 글자색, 버튼 높이 48 이상.
 */
import type { Status } from "./types";

export const C = {
  bg: "#F6F7F9",
  card: "#FFFFFF",
  line: "#E3E6EB",
  ink: "#16181D",
  ink2: "#3A3F4B",
  sub: "#646B7A",
  faint: "#A9AFBB",
  brand: "#2457D6",
  brandDark: "#1C46B0",
  brandSoft: "#EEF4FF",
  report: "#B26A00",
  reportSoft: "#FFF6E6",
  ok: "#1E7A44",
  okSoft: "#EAF7EF",
};

export const F = { xs: 13, sm: 15, md: 17, lg: 19, xl: 23, xxl: 28 };

export const STATUS_COLOR: Record<Status, { bg: string; fg: string }> = {
  보관중: { bg: C.okSoft, fg: C.ok },
  "현장에 있음": { bg: C.reportSoft, fg: C.report },
  "현장에 없음": { bg: C.bg, fg: C.sub },
  "주인 찾음": { bg: C.bg, fg: C.sub },
};

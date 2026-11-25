/**
 * 웹 푸시 (무료, 전화번호 필요 없음)
 *   1) 서비스 워커(/sw.js) 등록 → 2) 알림 허락 받기 → 3) 브라우저가 준 구독 정보를 서버에 저장
 *   서버(user 함수)는 새 알림이 생기면 이 구독으로 푸시를 보낸다.
 * 아이폰: 사파리에서 [공유 → 홈 화면에 추가] 한 뒤, 홈 화면 아이콘으로 열어야 알림을 켤 수 있다 (iOS 16.4+)
 */
import { apiPushSubscribe } from "./api";

// 공개 키 (서버의 VAPID_PRIVATE_KEY 짝). 공개해도 되는 값
const VAPID_PUBLIC_KEY = "BClzLzqUZ89iFo7UXL_QG0mm_8r-Egbw6dDn1HhLdCX6WxE3_g5bp_Hy8XBjNt_cesjs_pe3hNhNyOI2j_ewSqI";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return !!(await reg?.pushManager.getSubscription());
}

/** 성공하면 "", 아니면 사용자에게 보여 줄 말 */
export async function enablePush(): Promise<string> {
  if (!pushSupported()) {
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    return ios
      ? "아이폰은 사파리에서 [공유 → 홈 화면에 추가]를 한 뒤, 홈 화면의 '다시찾기' 아이콘으로 열어서 다시 눌러 주세요."
      : "이 브라우저는 알림을 지원하지 않아요. 크롬이나 엣지에서 열어 주세요.";
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "알림이 차단돼 있어요. 주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꿔 주세요.";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource }));
  await apiPushSubscribe(sub.toJSON());
  return "";
}

/** 홈 화면에 추가했을 때 앱처럼 열리게 (manifest) — 아이폰 웹 푸시에 필요 */
export function setupPwa() {
  if (typeof document === "undefined" || document.querySelector('link[rel="manifest"]')) return;
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = "/manifest.json";
  document.head.appendChild(link);
  for (const [name, content] of [["apple-mobile-web-app-capable", "yes"], ["mobile-web-app-capable", "yes"], ["apple-mobile-web-app-title", "다시찾기"], ["theme-color", "#2457D6"]]) {
    const m = document.createElement("meta");
    m.name = name;
    m.content = content;
    document.head.appendChild(m);
  }
  // 이미 알림을 켜 둔 브라우저면 서비스 워커를 다시 등록해 둔다 (업데이트 반영)
  if (pushSupported() && Notification.permission === "granted") navigator.serviceWorker.register("/sw.js").catch(() => {});
}

/**
 * 푸시 알림 — 휴대폰 앱(Expo Go)에서는 아직 못 받는다 (개발용 빌드가 필요).
 * 웹사이트(push.web.ts)에서 켜면 그 브라우저로 알림이 온다.
 */
export const pushSupported = () => false;
export const pushEnabled = async () => false;
export async function enablePush(): Promise<string> {
  return "휴대폰 앱(Expo Go)에서는 푸시를 받을 수 없어요. 웹사이트에서 마이페이지 → 알림 켜기를 눌러 주세요.";
}
export function setupPwa() {}

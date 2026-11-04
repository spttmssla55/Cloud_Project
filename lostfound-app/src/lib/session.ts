/**
 * 로그인 유지: 토큰을 휴대폰의 안전한 저장소(iOS 키체인 / Android Keystore)에 넣어 둔다
 *   → 앱을 껐다 켜도, Expo 를 다시 실행해도 로그인이 풀리지 않는다 (알림을 계속 받으려면 필요)
 * 웹 미리보기에서는 SecureStore 가 없어서 localStorage 를 쓴다. 어느 쪽이든 실패하면 조용히 넘어간다.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { User } from "./types";

const KEY = "dasi_session";
type Session = { token: string; user: User };

export async function saveSession(s: Session | null) {
  try {
    const v = s ? JSON.stringify(s) : null;
    if (Platform.OS === "web") {
      if (v) localStorage.setItem(KEY, v);
      else localStorage.removeItem(KEY);
    } else if (v) await SecureStore.setItemAsync(KEY, v);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // 저장 못 해도 이번 실행 동안은 로그인 상태로 쓴다
  }
}

export async function loadSession(): Promise<Session | null> {
  try {
    const v = Platform.OS === "web" ? localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    return v ? (JSON.parse(v) as Session) : null;
  } catch {
    return null;
  }
}

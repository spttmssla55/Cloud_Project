/**
 * 알림·확인 창 (휴대폰 앱 + 웹 둘 다)
 *   React Native 의 Alert 는 웹에서 아무것도 안 뜬다 → 웹에서는 브라우저 기본 창(alert/confirm)을 쓴다
 */
import { Alert, Platform } from "react-native";

/** 알려 주기만 (확인 버튼 하나) */
export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** 물어보기: [취소] [okText] → okText 를 누르면 onOk 실행 */
export function ask(title: string, message: string | undefined, okText: string, onOk: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: "취소", style: "cancel" },
    { text: okText, onPress: onOk },
  ]);
}

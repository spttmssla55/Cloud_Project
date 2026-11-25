/**
 * 휴대폰: 지도 HTML 을 WebView 로 (설치: npx expo install react-native-webview — Expo Go 에 들어 있음)
 * 웹은 LeafletMap.web.tsx (iframe)
 */
import { Linking, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

export type MapMessage = { type: "open"; atcId: string } | { type: "list"; keyword: string } | { type: "url"; url: string };

export default function LeafletMap({ html, onMessage, style }: { html: string; onMessage?: (m: MapMessage) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ overflow: "hidden" }, style ?? { flex: 1 }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://localhost/" }}
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1 }}
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data) as MapMessage;
            if (m.type === "url") Linking.openURL(m.url);
            else onMessage?.(m);
          } catch {
            /* 무시 */
          }
        }}
      />
    </View>
  );
}

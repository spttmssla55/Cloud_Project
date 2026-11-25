/** 웹: 지도 HTML 을 iframe 으로 (새 패키지 필요 없음) */
import { useEffect, useRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export type MapMessage = { type: "open"; atcId: string } | { type: "list"; keyword: string } | { type: "url"; url: string };

export default function LeafletMap({ html, onMessage, style }: { html: string; onMessage?: (m: MapMessage) => void; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      try {
        const m = JSON.parse(String(e.data)) as MapMessage;
        if (m.type === "url") window.open(m.url, "_blank", "noopener");
        else onMessage?.(m);
      } catch {
        /* 다른 메시지 무시 */
      }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [onMessage]);
  return (
    <View style={[{ overflow: "hidden" }, style ?? { flex: 1 }]}>
      <iframe ref={ref} srcDoc={html} title="지도" style={{ border: 0, width: "100%", height: "100%" }} allow="geolocation" />
    </View>
  );
}

/**
 * 지도 탭: 내 주변 습득물을 지도에서 보기
 *   파란 핀 = 경찰서·기관 보관 / 주황 핀 = 사용자 제보 (숫자 = 그 자리의 물건 수)
 *   핀을 누르면 최근 물건 5개 + [전체 보기] + [길찾기(카카오맵)]
 *   좌표는 서버가 보관 장소 이름으로 찾아 둔 것 (collector 가 조금씩 채움 → 처음엔 핀이 적을 수 있음)
 */
import * as Location from "expo-location";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import LeafletMap, { type MapMessage } from "@/components/LeafletMap";
import { Chip } from "@/components/ui";
import { API_BASE, IS_MOCK } from "@/lib/api";
import { notify } from "@/lib/dialog";
import { browseHtml } from "@/lib/mapHtml";
import { C, F } from "@/lib/theme";

const DAYS = [3, 7, 14, 30];
const SEOUL = { lat: 37.5665, lng: 126.978 };

export default function MapScreen() {
  const [days, setDays] = useState(14);
  const [center, setCenter] = useState(SEOUL);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // 설정이 바뀌면 지도 HTML 을 새로 만든다 (그 안에서 API 를 직접 부름)
  const html = useMemo(() => browseHtml({ api: API_BASE, center, zoom: me ? 15 : 13, days, me }), [center, days, me]);

  async function locate() {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return notify("위치 권한이 필요해요", "설정에서 위치 권한을 켜 주세요.");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMe(p);
      setCenter(p);
    } catch {
      notify("위치를 찾지 못했어요", "잠시 후 다시 눌러 주세요.");
    } finally {
      setLocating(false);
    }
  }

  const onMessage = useCallback((m: MapMessage) => {
    if (m.type === "open") router.push({ pathname: "/item/[id]", params: { id: m.atcId, sn: "1" } });
    if (m.type === "list") router.push({ pathname: "/items", params: { keyword: m.keyword, days: String(days), t: String(Date.now()) } });
  }, [days]);

  if (IS_MOCK) {
    return (
      <View style={st.center}>
        <Text style={st.empty}>서버(EXPO_PUBLIC_API_URL)를 연결하면 지도가 보여요.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.bar} contentContainerStyle={st.barIn}>
        <Chip label={locating ? "찾는 중…" : "📍 내 주변"} on={!!me} onPress={locate} disabled={locating} />
        {DAYS.map((d) => (
          <Chip key={d} label={`최근 ${d}일`} on={days === d} onPress={() => setDays(d)} />
        ))}
      </ScrollView>
      <View style={st.legend}>
        <Text style={st.legendText}><Text style={{ color: C.brand }}>●</Text> 경찰서·기관 보관   <Text style={{ color: "#E08600" }}>●</Text> 사용자 제보   숫자 = 물건 수</Text>
      </View>
      <LeafletMap key={html.length + String(center.lat) + days} html={html} onMessage={onMessage} />
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: C.bg },
  empty: { fontSize: F.md, color: C.sub, textAlign: "center" },
  bar: { flexGrow: 0, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  barIn: { gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  legend: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: C.card },
  legendText: { fontSize: F.xs, color: C.sub },
});

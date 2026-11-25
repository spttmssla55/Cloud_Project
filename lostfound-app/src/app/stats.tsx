/**
 * 분실 통계 (누구나) — "어떤 물건을, 어디서, 무슨 요일에 많이 잃어버리나"
 *   경찰청 + 사용자 제보 습득물 전체 기준 (GET /stats/insights)
 *   운영 숫자(AI 판정·매칭·수집 상태)는 운영자 페이지에 따로 있다
 */
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Chip } from "@/components/ui";
import { apiInsights } from "@/lib/api";
import { C, F } from "@/lib/theme";
import type { Insights } from "@/lib/types";

const RANGES = [7, 30, 90];

export default function StatsScreen() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setError("");
    apiInsights(days).then(setData).catch((e) => setError((e as Error).message));
  }, [days]);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {RANGES.map((d) => (
          <Chip key={d} label={`최근 ${d}일`} on={days === d} onPress={() => setDays(d)} />
        ))}
      </View>
      {!!error && <Text style={st.error}>{error}</Text>}
      {!data && !error && <ActivityIndicator color={C.brand} style={{ marginTop: 30 }} />}
      {data && (
        <>
          <View style={st.kpis}>
            <Kpi label={`최근 ${data.days}일 습득물`} value={data.total} />
            <Kpi label="주인을 찾은 물건" value={data.returned} accent />
            <Kpi label="AI가 찾아 준 비슷한 물건" value={data.matched} />
          </View>
          <Bars title="📦 가장 많이 잃어버리는 종류" rows={data.categories} onPress={(l) => open({ category: l })} />
          <Bars title="🏷️ 물건 이름 TOP 10" rows={data.names} onPress={(l) => open({ keyword: l })} />
          <Bars title="📍 습득물이 가장 많은 곳" rows={data.places} onPress={(l) => open({ keyword: l })} />
          <Bars title="🎨 색깔" rows={data.colors} />
          <Columns title="📅 요일별 (습득일 기준)" rows={data.weekdays} />
          <Columns title="📈 최근 2주 하루 습득물" rows={data.daily.map((d) => ({ label: d.label.slice(5).replace("-", "/"), count: d.count }))} small />
          <Text style={st.note}>경찰청 습득물 공개 데이터와 다시찾기 사용자 제보를 합친 숫자예요. 사진이 있는 물건은 {data.withPhoto.toLocaleString()}개예요.</Text>
        </>
      )}
    </ScrollView>
  );

  function open(p: { category?: string; keyword?: string }) {
    router.push({ pathname: "/items", params: { ...p, t: String(Date.now()) } });
  }
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={st.kpi}>
      <Text style={[st.kpiValue, accent && { color: C.ok }]}>{value.toLocaleString()}</Text>
      <Text style={st.kpiLabel}>{label}</Text>
    </View>
  );
}

function Bars({ title, rows, onPress }: { title: string; rows: { label: string; count: number }[]; onPress?: (label: string) => void }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <View style={st.card}>
      <Text style={st.h2}>{title}</Text>
      {rows.map((r, i) => (
        <Pressable key={r.label} disabled={!onPress} onPress={() => onPress?.(r.label)} style={st.barRow} accessibilityRole={onPress ? "button" : undefined}>
          <Text style={st.barLabel} numberOfLines={1}>{i + 1}. {r.label}</Text>
          <View style={st.barTrack}>
            <View style={[st.barFill, { width: `${Math.max(3, (r.count / max) * 100)}%` }, i === 0 && { backgroundColor: C.brand }]} />
          </View>
          <Text style={st.barCount}>{r.count.toLocaleString()}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Columns({ title, rows, small }: { title: string; rows: { label: string; count: number }[]; small?: boolean }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <View style={st.card}>
      <Text style={st.h2}>{title}</Text>
      <View style={st.cols}>
        {rows.map((r) => (
          <View key={r.label} style={st.col}>
            <Text style={st.colCount}>{small ? "" : r.count.toLocaleString()}</Text>
            <View style={[st.colBar, { height: Math.max(4, (r.count / max) * 110) }, r.count === max && { backgroundColor: C.brand }]} />
            <Text style={[st.colLabel, small && { fontSize: 10 }]}>{r.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  error: { color: "#C62828", fontWeight: "700", fontSize: F.sm },
  kpis: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  kpiValue: { fontSize: F.xl, fontWeight: "800", color: C.ink },
  kpiLabel: { fontSize: F.xs, color: C.sub, marginTop: 2 },
  card: { padding: 16, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, gap: 8 },
  h2: { fontSize: F.md, fontWeight: "800", color: C.ink, marginBottom: 4 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { width: 112, fontSize: F.sm, color: C.ink2 },
  barTrack: { flex: 1, height: 14, borderRadius: 7, backgroundColor: C.bg, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 7, backgroundColor: "#9DB6EE" },
  barCount: { width: 56, textAlign: "right", fontSize: F.sm, fontWeight: "700", color: C.ink },
  cols: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 150 },
  col: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  colBar: { width: "70%", borderRadius: 4, backgroundColor: "#9DB6EE" },
  colCount: { fontSize: 10, color: C.sub },
  colLabel: { fontSize: F.xs, color: C.sub },
  note: { fontSize: F.xs, color: C.sub, lineHeight: 18 },
});

/**
 * 홈: 할 일 두 개(주웠어요 / 잃어버렸어요) + 습득물 숫자 두 개
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getStats, IS_MOCK } from "@/lib/api";
import { SITE_TAGLINE } from "@/lib/site";
import { useApp } from "@/lib/store";
import { C, F } from "@/lib/theme";
import type { Stats } from "@/lib/types";

export default function HomeScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const version = useApp((s) => s.version); // 새 습득물이 등록되면 숫자도 새로
  const unread = useApp((s) => s.notices.filter((n) => !n.read).length);

  useFocusEffect(
    useCallback(() => {
      getStats().then(setStats).catch(() => setStats(null));
    }, [version]),
  );

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={st.h1}>{SITE_TAGLINE}</Text>
      <Text style={st.lead}>주운 물건은 사진만 찍으면 AI가 정리해서 등록하고, 잃어버린 물건은 챗봇이 함께 찾아요.</Text>

      {unread > 0 && (
        <Pressable onPress={() => router.push("/my")} style={st.notice} accessibilityRole="button">
          <Text style={st.noticeText}>🔔 잃어버린 물건과 비슷한 습득물이 {unread}건 등록됐어요</Text>
          <Text style={{ color: C.brandDark, fontSize: 20 }}>›</Text>
        </Pressable>
      )}

      {/* 1. 할 일 두 개 */}
      <View style={{ gap: 12, marginTop: 22 }}>
        <BigAction emoji="🙋" title="물건을 주웠어요" sub="사진 한 장으로 등록" onPress={() => router.push({ pathname: "/chat", params: { start: "found" } })} />
        <BigAction emoji="🔎" title="물건을 잃어버렸어요" sub="챗봇이 함께 찾고, 들어오면 알려 드려요" strong onPress={() => router.push({ pathname: "/chat", params: { start: "lost" } })} />
      </View>

      {/* 2. 숫자 두 개 */}
      <View style={st.statsRow}>
        <StatBox label="보관 중인 습득물" value={stats?.total} onPress={() => router.push("/items")} />
        <StatBox label="오늘 새로 들어온 물건" value={stats?.today} accent onPress={() => router.push({ pathname: "/items", params: { days: "1" } })} />
      </View>
      {IS_MOCK && <Text style={st.mock}>지금은 예시 데이터 기준 숫자예요.</Text>}
    </ScrollView>
  );
}

function BigAction({ emoji, title, sub, strong, onPress }: { emoji: string; title: string; sub: string; strong?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [st.action, strong && st.actionStrong, pressed && { opacity: 0.7 }]}>
      <Text style={{ fontSize: 34 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[st.actionTitle, strong && { color: C.brandDark }]}>{title}</Text>
        <Text style={st.actionSub}>{sub}</Text>
      </View>
      <Text style={{ fontSize: 24, color: C.faint }}>›</Text>
    </Pressable>
  );
}

function StatBox({ label, value, accent, onPress }: { label: string; value?: number; accent?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [st.stat, pressed && { opacity: 0.7 }]}>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={[st.statValue, accent && { color: C.brand }]}>
        {value ?? "–"}
        <Text style={st.statUnit}> 개</Text>
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  h1: { fontSize: F.xxl, fontWeight: "800", color: C.ink, lineHeight: 36, marginTop: 4 },
  lead: { fontSize: F.md, color: C.sub, marginTop: 8, lineHeight: 25 },
  notice: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: C.brandSoft,
    borderWidth: 1,
    borderColor: C.brand,
  },
  noticeText: { flex: 1, fontSize: F.sm, fontWeight: "700", color: C.brandDark, lineHeight: 21 },
  action: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  actionStrong: { borderColor: C.brand, backgroundColor: C.brandSoft },
  actionTitle: { fontSize: F.xl, fontWeight: "800", color: C.ink },
  actionSub: { fontSize: F.sm, color: C.sub, marginTop: 3 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 22 },
  stat: { flex: 1, padding: 18, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  statLabel: { fontSize: F.sm, color: C.sub, fontWeight: "600" },
  statValue: { fontSize: 34, fontWeight: "800", color: C.ink, marginTop: 6 },
  statUnit: { fontSize: F.md, fontWeight: "600", color: C.sub },
  mock: { fontSize: F.xs, color: C.sub, marginTop: 10, textAlign: "center" },
});

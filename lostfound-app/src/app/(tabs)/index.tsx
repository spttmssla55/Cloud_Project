/**
 * 홈: 할 일 두 개(주웠어요 / 잃어버렸어요) + 습득물 숫자 두 개 + 최근 등록된 습득물(사진 있는 것, 옆으로 넘기기)
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Thumb } from "@/components/ui";
import { getStats, IS_MOCK, listItems } from "@/lib/api";
import { SOURCE_LABEL } from "@/lib/format";
import { SITE_TAGLINE } from "@/lib/site";
import { refreshMe, useApp } from "@/lib/store";
import { C, F } from "@/lib/theme";
import type { FoundItem, Stats } from "@/lib/types";

export default function HomeScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<FoundItem[] | null>(null);
  const version = useApp((s) => s.version); // 새 습득물이 등록되면 숫자도 새로
  const unread = useApp((s) => s.notices.filter((n) => !n.read).length);

  useFocusEffect(
    useCallback(() => {
      getStats().then(setStats).catch(() => setStats(null));
      listItems({ photo: 1, size: 10 }).then((r) => setRecent(r.items)).catch(() => setRecent([]));
      refreshMe(); // 새 알림 확인
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

      {/* 3. 최근 등록된 습득물 (사진 있는 것 10개, 옆으로 넘기기) */}
      <Recent items={recent} />
    </ScrollView>
  );
}

function Recent({ items }: { items: FoundItem[] | null }) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(260, Math.round((width - 40) * 0.72));
  if (items && items.length === 0) return null;
  return (
    <View style={{ marginTop: 30 }}>
      <View style={st.recentHead}>
        <Text style={st.h2}>최근 등록된 습득물</Text>
        <Pressable onPress={() => router.push("/items")} accessibilityRole="button" hitSlop={10}>
          <Text style={st.more}>전체 보기 ›</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={items ?? []}
        keyExtractor={(it) => it.atcId}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW + 12}
        decelerationRate="fast"
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
        ListEmptyComponent={<View style={[st.recentCard, { width: cardW, height: cardW * 0.75 + 110 }]} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.atcId, sn: item.fdSn } })}
            style={({ pressed }) => [st.recentCard, { width: cardW }, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={`${item.fdPrdtNm}, 습득일 ${item.fdYmd}`}
          >
            <Thumb item={item} size="full" />
            <Text style={st.recentName} numberOfLines={1}>{item.fdPrdtNm}</Text>
            <View style={st.recentRow}>
              <Text style={st.recentKey}>습득일자</Text>
              <Text style={st.recentVal}>{item.fdYmd}</Text>
            </View>
            <View style={st.recentRow}>
              <Text style={st.recentKey}>보관장소</Text>
              <Text style={st.recentVal} numberOfLines={1}>{item.depPlace}</Text>
            </View>
            <View style={st.recentFoot}>
              <Text style={st.recentSrc}>{SOURCE_LABEL[item.source]}</Text>
              <Text style={st.recentLink}>자세히 보기 →</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
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
  recentHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
  h2: { fontSize: F.xl, fontWeight: "800", color: C.ink },
  more: { fontSize: F.sm, fontWeight: "700", color: C.brand },
  recentCard: { padding: 12, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  recentName: { fontSize: F.lg, fontWeight: "800", color: C.ink, marginTop: 10, marginBottom: 6 },
  recentRow: { flexDirection: "row", gap: 10, marginTop: 3 },
  recentKey: { width: 60, fontSize: F.sm, fontWeight: "700", color: C.ink2 },
  recentVal: { flex: 1, fontSize: F.sm, color: C.sub },
  recentFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line },
  recentSrc: { fontSize: F.xs, color: C.sub },
  recentLink: { fontSize: F.sm, fontWeight: "700", color: C.ink },
});

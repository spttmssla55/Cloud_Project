/**
 * 목록 탭: "주웠어요 / 잃어버렸어요" 두 버튼 + 습득물 목록
 */
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Chip, ItemCard } from "@/components/ui";
import { IS_MOCK, listItems } from "@/lib/api";
import { CATEGORIES } from "@/lib/mock-data";
import { SITE_TAGLINE } from "@/lib/site";
import { C, F } from "@/lib/theme";
import type { FoundItem, ListQuery, Source } from "@/lib/types";

const SOURCES: { value: Source | "all"; label: string; disabled?: boolean }[] = [
  { value: "all", label: "전체" },
  { value: "portal", label: "지하철·공항·쇼핑몰" },
  { value: "user", label: "사용자 제보" },
  { value: "police", label: "경찰서 (준비 중)", disabled: true },
];
const PERIODS = [
  { value: 0, label: "전체 기간" },
  { value: 1, label: "오늘·어제" },
  { value: 7, label: "최근 7일" },
];

export default function ListScreen() {
  const [q, setQ] = useState<ListQuery>({ source: "all", days: 0 });
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<FoundItem[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setItems(await listItems(q));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  const header = (
    <View>
      {/* 1. 할 일 두 개만 크게 */}
      <View style={st.hero}>
        <Text style={st.h1}>{SITE_TAGLINE}</Text>
        <Text style={st.lead}>주운 물건은 사진만 찍으면 AI가 정리해서 등록하고, 잃어버린 물건은 챗봇이 함께 찾아요.</Text>
        <View style={{ gap: 10, marginTop: 18 }}>
          <BigAction emoji="🙋" title="물건을 주웠어요" sub="사진 한 장으로 등록" onPress={() => router.push({ pathname: "/chat", params: { start: "found" } })} />
          <BigAction emoji="🔎" title="물건을 잃어버렸어요" sub="챗봇이 함께 찾아요" strong onPress={() => router.push({ pathname: "/chat", params: { start: "lost" } })} />
        </View>
      </View>

      {/* 2. 검색 · 필터 */}
      <View style={st.section}>
        <View style={st.rowBetween}>
          <Text style={st.h2}>최근 습득물</Text>
          {IS_MOCK && <Text style={st.mock}>예시 데이터</Text>}
        </View>
        <View style={st.searchRow}>
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => setQ({ ...q, keyword })}
            placeholder="예: 지갑, 신구대"
            placeholderTextColor={C.faint}
            returnKeyType="search"
            style={st.search}
            accessibilityLabel="물건 이름이나 장소로 검색"
          />
          <Pressable style={st.searchBtn} onPress={() => setQ({ ...q, keyword })} accessibilityRole="button">
            <Text style={st.searchBtnText}>검색</Text>
          </Pressable>
        </View>
        <ChipRow label="어디서 온 물건">
          {SOURCES.map((s) => (
            <Chip key={s.value} label={s.label} on={q.source === s.value} disabled={s.disabled} onPress={() => setQ({ ...q, source: s.value })} />
          ))}
        </ChipRow>
        <ChipRow label="종류">
          <Chip label="전체" on={!q.category} onPress={() => setQ({ ...q, category: undefined })} />
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} on={q.category === c} onPress={() => setQ({ ...q, category: c })} />
          ))}
        </ChipRow>
        <ChipRow label="기간">
          {PERIODS.map((p) => (
            <Chip key={p.value} label={p.label} on={q.days === p.value} onPress={() => setQ({ ...q, days: p.value })} />
          ))}
        </ChipRow>
        {items && <Text style={st.count}>{items.length}건</Text>}
      </View>
    </View>
  );

  return (
    <FlatList
      data={items ?? []}
      keyExtractor={(it) => `${it.atcId}-${it.fdSn}`}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: 16 }}>
          <ItemCard item={item} />
        </View>
      )}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      contentContainerStyle={{ paddingBottom: 32 }}
      style={{ backgroundColor: C.bg }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListEmptyComponent={
        error ? (
          <Text style={st.empty}>{error}</Text>
        ) : !items ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={C.brand} />
        ) : (
          <View style={st.emptyBox}>
            <Text style={st.emptyTitle}>조건에 맞는 습득물이 없어요.</Text>
            <Text style={st.emptySub}>챗봇에게 물건을 설명하면 비슷한 물건이 들어올 때 알려 드려요.</Text>
          </View>
        )
      }
    />
  );
}

function BigAction({ emoji, title, sub, strong, onPress }: { emoji: string; title: string; sub: string; strong?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [st.action, strong && st.actionStrong, pressed && { opacity: 0.7 }]}
    >
      <Text style={{ fontSize: 30 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[st.actionTitle, strong && { color: C.brandDark }]}>{title}</Text>
        <Text style={st.actionSub}>{sub}</Text>
      </View>
      <Text style={{ fontSize: 22, color: C.faint }}>›</Text>
    </Pressable>
  );
}

/** 이름 + 옆으로 밀어서 보는 칩 줄 */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={st.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
        {children}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { backgroundColor: C.card, padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: C.line },
  h1: { fontSize: F.xxl, fontWeight: "800", color: C.ink, lineHeight: 36 },
  lead: { fontSize: F.md, color: C.sub, marginTop: 8, lineHeight: 25 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
  },
  actionStrong: { borderColor: C.brand, backgroundColor: C.brandSoft },
  actionTitle: { fontSize: F.lg, fontWeight: "800", color: C.ink },
  actionSub: { fontSize: F.sm, color: C.sub, marginTop: 2 },
  section: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 12 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h2: { fontSize: F.xl, fontWeight: "800", color: C.ink },
  mock: { fontSize: F.xs, color: C.sub, backgroundColor: C.line, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  search: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    paddingHorizontal: 14,
    fontSize: F.md,
    color: C.ink,
  },
  searchBtn: { backgroundColor: C.brand, borderRadius: 14, paddingHorizontal: 18, justifyContent: "center" },
  searchBtnText: { color: "#fff", fontSize: F.md, fontWeight: "700" },
  label: { fontSize: F.sm, color: C.sub, fontWeight: "600", marginBottom: 6 },
  count: { fontSize: F.sm, color: C.sub, marginTop: 16 },
  empty: { textAlign: "center", color: C.ink2, fontSize: F.md, marginTop: 24 },
  emptyBox: { marginHorizontal: 16, padding: 24, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line },
  emptyTitle: { fontSize: F.md, fontWeight: "700", color: C.ink, textAlign: "center" },
  emptySub: { fontSize: F.sm, color: C.sub, textAlign: "center", marginTop: 6, lineHeight: 22 },
});

/**
 * 습득물 탭: 검색 + 카테고리별 보기 + 목록
 */
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Chip, ItemCard } from "@/components/ui";
import { IS_MOCK, listItems } from "@/lib/api";
import { categoryEmoji } from "@/lib/format";
import { CATEGORIES } from "@/lib/mock-data";
import { useApp } from "@/lib/store";
import { C, F } from "@/lib/theme";
import type { FoundItem, Source } from "@/lib/types";

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

export default function ItemsScreen() {
  const params = useLocalSearchParams<{ days?: string }>();
  const version = useApp((s) => s.version);
  const [all, setAll] = useState<FoundItem[] | null>(null);
  const [category, setCategory] = useState<string | undefined>();
  const [source, setSource] = useState<Source | "all">("all");
  const [days, setDays] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [applied, setApplied] = useState("");

  // 홈의 "오늘 새로 들어온 물건"을 눌러서 오면 기간을 맞춘다
  useEffect(() => {
    if (params.days) setDays(Number(params.days));
  }, [params.days]);

  // 기간·출처·검색어로 서버에서 가져오고, 종류는 화면에서 나눈다 (종류별 개수를 보여 주려고)
  useFocusEffect(
    useCallback(() => {
      setAll(null);
      listItems({ source, days, keyword: applied }).then(setAll).catch(() => setAll([]));
    }, [source, days, applied, version]),
  );

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of all ?? []) {
      const c = it.prdtClNm.split(">")[0].trim();
      m[c] = (m[c] ?? 0) + 1;
    }
    return m;
  }, [all]);
  const shown = (all ?? []).filter((it) => !category || it.prdtClNm.startsWith(category));

  const header = (
    <View style={{ padding: 16, paddingBottom: 8 }}>
      {/* 검색 */}
      <View style={st.searchRow}>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={() => setApplied(keyword.trim())}
          placeholder="물건 이름, 색, 장소 (예: 검정 지갑)"
          placeholderTextColor={C.faint}
          returnKeyType="search"
          style={st.search}
          accessibilityLabel="습득물 검색"
        />
        <Pressable style={st.searchBtn} onPress={() => setApplied(keyword.trim())} accessibilityRole="button">
          <Text style={st.searchBtnText}>검색</Text>
        </Pressable>
      </View>
      {!!applied && (
        <Pressable onPress={() => { setKeyword(""); setApplied(""); }} style={{ marginTop: 8 }}>
          <Text style={{ color: C.brand, fontSize: F.sm, fontWeight: "700" }}>“{applied}” 검색 중 · 지우기 ✕</Text>
        </Pressable>
      )}

      {/* 카테고리 */}
      <Text style={st.label}>카테고리</Text>
      <View style={st.grid}>
        <CatTile emoji="🧺" name="전체" count={all?.length} on={!category} onPress={() => setCategory(undefined)} />
        {CATEGORIES.map((c) => (
          <CatTile key={c} emoji={categoryEmoji(c)} name={c} count={counts[c] ?? 0} on={category === c} onPress={() => setCategory(category === c ? undefined : c)} />
        ))}
      </View>

      {/* 출처 · 기간 */}
      <ChipRow label="어디서 온 물건">
        {SOURCES.map((s) => (
          <Chip key={s.value} label={s.label} on={source === s.value} disabled={s.disabled} onPress={() => setSource(s.value)} />
        ))}
      </ChipRow>
      <ChipRow label="기간">
        {PERIODS.map((p) => (
          <Chip key={p.value} label={p.label} on={days === p.value} onPress={() => setDays(p.value)} />
        ))}
      </ChipRow>

      <View style={st.countRow}>
        <Text style={st.count}>{category ?? "전체"} {all ? `${shown.length}건` : ""}</Text>
        {IS_MOCK && <Text style={st.mock}>예시 데이터</Text>}
      </View>
    </View>
  );

  return (
    <FlatList
      data={shown}
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
      ListEmptyComponent={
        !all ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={C.brand} />
        ) : (
          <View style={st.emptyBox}>
            <Text style={st.emptyTitle}>조건에 맞는 습득물이 없어요.</Text>
            <Text style={st.emptySub}>챗봇에게 잃어버린 물건을 알려 주면, 비슷한 물건이 들어올 때 알려 드려요.</Text>
          </View>
        )
      }
    />
  );
}

function CatTile({ emoji, name, count, on, onPress }: { emoji: string; name: string; count?: number; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[st.tile, on && st.tileOn]}>
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <Text style={[st.tileName, on && { color: C.brandDark }]}>{name}</Text>
      <Text style={st.tileCount}>{count ?? "–"}</Text>
    </Pressable>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[st.label, { marginTop: 0 }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
        {children}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  searchRow: { flexDirection: "row", gap: 8 },
  search: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 14, fontSize: F.md, color: C.ink },
  searchBtn: { backgroundColor: C.brand, borderRadius: 14, paddingHorizontal: 18, justifyContent: "center" },
  searchBtnText: { color: "#fff", fontSize: F.md, fontWeight: "700" },
  label: { fontSize: F.sm, color: C.sub, fontWeight: "600", marginTop: 18, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "22.6%", alignItems: "center", paddingVertical: 10, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  tileOn: { borderColor: C.brand, borderWidth: 2, backgroundColor: C.brandSoft },
  tileName: { fontSize: F.sm, fontWeight: "700", color: C.ink, marginTop: 2 },
  tileCount: { fontSize: F.xs, color: C.sub },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
  count: { fontSize: F.lg, fontWeight: "800", color: C.ink },
  mock: { fontSize: F.xs, color: C.sub, backgroundColor: C.line, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" },
  emptyBox: { marginHorizontal: 16, padding: 24, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line },
  emptyTitle: { fontSize: F.md, fontWeight: "700", color: C.ink, textAlign: "center" },
  emptySub: { fontSize: F.sm, color: C.sub, textAlign: "center", marginTop: 6, lineHeight: 22 },
});

/**
 * 습득물 탭: 검색 + 카테고리별 보기 + 목록 (30건씩, 아래로 스크롤하면 더)
 */
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { DateRangePicker, shortRange, type Range } from "@/components/DateRangePicker";
import { Chip, ItemCard } from "@/components/ui";
import { IS_MOCK, listItems } from "@/lib/api";
import { categoryEmoji, localYmd } from "@/lib/format";
import { useApp } from "@/lib/store";
import { C, F } from "@/lib/theme";
import type { FoundItem, Source } from "@/lib/types";

const SOURCES: { value: Source | "all"; label: string; disabled?: boolean }[] = [
  { value: "all", label: "전체" },
  { value: "portal", label: "지하철·공항·쇼핑몰" },
  { value: "user", label: "사용자 제보" },
  { value: "police", label: "경찰서" },
];
const PERIODS = [
  { value: 0, label: "전체 기간" },
  { value: 1, label: "오늘·어제" },
  { value: 7, label: "최근 7일" },
  { value: 30, label: "최근 30일" },
];

const PAGE = 30;
const SHOW_CATS = 7; // 처음엔 많은 순 7개만, '더보기'로 전체

export default function ItemsScreen() {
  // 홈 '오늘 새로 들어온 물건' → days, 챗봇 '비슷한 물건 전체 보기' → category·from·keyword (t 는 같은 조건으로 또 와도 다시 적용하려고)
  const params = useLocalSearchParams<{ days?: string; category?: string; from?: string; keyword?: string; t?: string }>();
  const version = useApp((s) => s.version);
  const [items, setItems] = useState<FoundItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | undefined>();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [moreCats, setMoreCats] = useState(false);
  const [category, setCategory] = useState<string | undefined>();
  const [source, setSource] = useState<Source | "all">("all");
  const [days, setDays] = useState(0);
  const [range, setRange] = useState<Range | undefined>(); // 직접 고른 기간 (있으면 days 대신)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [applied, setApplied] = useState("");
  const reqId = useRef(0); // 조건을 빨리 바꿨을 때 늦게 온 옛 응답은 버린다

  // 홈의 "오늘 새로 들어온 물건"을 눌러서 오면 기간을 맞춘다
  useEffect(() => {
    if (params.days) {
      setDays(Number(params.days));
      setRange(undefined);
    }
  }, [params.days]);
  useEffect(() => {
    if (!params.t) return;
    setCategory(params.category || undefined);
    setKeyword(params.keyword ?? "");
    setApplied(params.keyword ?? "");
    setSource("all");
    setRange(params.from ? { from: params.from, to: localYmd() } : undefined);
    if (!params.from) setDays(0);
  }, [params.t]); // eslint-disable-line react-hooks/exhaustive-deps

  // 조건이 바뀌면 1페이지부터 다시 (30건씩)
  useFocusEffect(
    useCallback(() => {
      const id = ++reqId.current;
      setItems(null);
      listItems({ source, days: range ? 0 : days, from: range?.from, to: range?.to, keyword: applied, category, page: 1, size: PAGE })
        .then((r) => {
          if (id !== reqId.current) return;
          setItems(r.items);
          setPage(1);
          setHasMore(r.hasMore);
          setTotal(r.total);
          setCounts(r.counts ?? {});
        })
        .catch(() => id === reqId.current && (setItems([]), setHasMore(false)));
    }, [source, days, range, applied, category, version]),
  );

  // 아래 끝까지 스크롤하면 다음 30건
  const loadMore = () => {
    if (!items || !hasMore || loadingMore) return;
    const id = reqId.current;
    setLoadingMore(true);
    listItems({ source, days: range ? 0 : days, from: range?.from, to: range?.to, keyword: applied, category, page: page + 1, size: PAGE })
      .then((r) => {
        if (id !== reqId.current) return;
        setItems((prev) => {
          const seen = new Set((prev ?? []).map((it) => it.atcId));
          return [...(prev ?? []), ...r.items.filter((it) => !seen.has(it.atcId))];
        });
        setPage(r.page);
        setHasMore(r.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  // 종류: 서버가 준 개수 많은 순. 선택한 종류는 접혀 있어도 보이게
  const cats = useMemo(() => Object.entries(counts).sort((a, b) => b[1] - a[1]), [counts]);
  const allCount = useMemo(() => cats.reduce((n, [, c]) => n + c, 0), [cats]);
  const visibleCats = moreCats ? cats : cats.filter(([c], i) => i < SHOW_CATS || c === category);

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

      {/* 카테고리 (개수 많은 순) */}
      <Text style={st.label}>카테고리</Text>
      <View style={st.grid}>
        <CatTile emoji="🧺" name="전체" count={allCount} on={!category} onPress={() => setCategory(undefined)} />
        {visibleCats.map(([c, n]) => (
          <CatTile key={c} emoji={categoryEmoji(c)} name={c} count={n} on={category === c} onPress={() => setCategory(category === c ? undefined : c)} />
        ))}
      </View>
      {cats.length > SHOW_CATS && (
        <Pressable onPress={() => setMoreCats(!moreCats)} style={st.moreCats} accessibilityRole="button">
          <Text style={st.moreCatsText}>{moreCats ? "접기 ▲" : `카테고리 ${cats.length - SHOW_CATS}개 더보기 ▼`}</Text>
        </Pressable>
      )}

      {/* 출처 · 기간 */}
      <ChipRow label="어디서 온 물건">
        {SOURCES.map((s) => (
          <Chip key={s.value} label={s.label} on={source === s.value} disabled={s.disabled} onPress={() => setSource(s.value)} />
        ))}
      </ChipRow>
      <ChipRow label="기간">
        {PERIODS.map((p) => (
          <Chip key={p.value} label={p.label} on={!range && days === p.value} onPress={() => { setRange(undefined); setDays(p.value); }} />
        ))}
        <Chip label={range ? `📅 ${shortRange(range)}` : "📅 직접 선택"} on={!!range} onPress={() => setPickerOpen(true)} />
      </ChipRow>
      {range && (
        <Pressable onPress={() => setRange(undefined)} style={{ marginTop: 8 }} accessibilityRole="button">
          <Text style={{ color: C.brand, fontSize: F.sm, fontWeight: "700" }}>📅 {shortRange(range)} 습득물만 보는 중 · 지우기 ✕</Text>
        </Pressable>
      )}
      <DateRangePicker visible={pickerOpen} value={range} onClose={() => setPickerOpen(false)} onApply={(r) => { setRange(r); setPickerOpen(false); }} />

      <View style={st.countRow}>
        <Text style={st.count}>
          {category ?? "전체"} {total !== undefined && items ? `${total.toLocaleString()}건` : ""}
        </Text>
        {IS_MOCK && <Text style={st.mock}>예시 데이터</Text>}
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
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      ListFooterComponent={
        items && items.length > 0 ? (
          <View style={st.footer}>
            {loadingMore ? (
              <ActivityIndicator color={C.brand} />
            ) : hasMore ? (
              <Pressable onPress={loadMore} style={st.moreBtn} accessibilityRole="button">
                <Text style={st.moreBtnText}>더 보기 ({items.length.toLocaleString()} / {(total ?? items.length).toLocaleString()})</Text>
              </Pressable>
            ) : (
              <Text style={st.endText}>마지막 물건이에요 · {items.length.toLocaleString()}건</Text>
            )}
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        !items ? (
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
  moreCats: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 14 },
  moreCatsText: { fontSize: F.sm, fontWeight: "700", color: C.brand },
  footer: { paddingVertical: 18, alignItems: "center" },
  moreBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  moreBtnText: { fontSize: F.sm, fontWeight: "700", color: C.ink2 },
  endText: { fontSize: F.sm, color: C.sub },
  emptyBox: { marginHorizontal: 16, padding: 24, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line },
  emptyTitle: { fontSize: F.md, fontWeight: "700", color: C.ink, textAlign: "center" },
  emptySub: { fontSize: F.sm, color: C.sub, textAlign: "center", marginTop: 6, lineHeight: 22 },
});

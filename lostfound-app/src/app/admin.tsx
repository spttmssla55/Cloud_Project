/**
 * 운영자 페이지 (role = admin 만)
 *   사용자가 [제 물건이에요]를 누른 물건이 카드로 들어온다 (그동안 그 물건은 목록에서 숨김 '확인 중')
 *   [✅ 찾음]  → 습득물 '주인 찾음' (목록에서 빠짐. DB 에서 지우지는 않음)
 *   [↩️ 못찾음] → 원래 상태로 되돌려 다시 목록에 보이게
 *   처리하면 요청한 사람에게 알림이 간다
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, ItemCard } from "@/components/ui";
import { apiAdminClaims, apiResolveClaim } from "@/lib/api";
import { timeText } from "@/lib/format";
import { useApp } from "@/lib/store";
import { C, F } from "@/lib/theme";
import type { Claim } from "@/lib/types";

export default function AdminScreen() {
  const isAdmin = useApp((s) => s.user?.role === "admin");
  const [data, setData] = useState<{ waiting: Claim[]; done: Claim[] } | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await apiAdminClaims());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isAdmin) load();
    }, [isAdmin, load]),
  );

  function resolve(c: Claim, result: "found" | "notfound") {
    const name = `${c.item.clrNm ?? ""} ${c.item.fdPrdtNm}`.trim();
    Alert.alert(
      result === "found" ? "찾음으로 처리할까요?" : "못찾음으로 처리할까요?",
      result === "found"
        ? `‘${name}’을 주인 찾음으로 바꾸고 목록에서 뺄게요. (기록은 남아요)`
        : `‘${name}’을 다시 목록에 보이게 할게요.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: result === "found" ? "찾음" : "못찾음",
          onPress: async () => {
            setBusyId(c.id);
            try {
              await apiResolveClaim(c.id, result);
              await load();
            } catch (e) {
              Alert.alert("처리하지 못했어요", (e as Error).message);
            } finally {
              setBusyId("");
            }
          },
        },
      ],
    );
  }

  if (!isAdmin) {
    return (
      <View style={st.center}>
        <Text style={st.empty}>운영자만 볼 수 있어요.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Text style={st.lead}>사용자가 <Text style={{ fontWeight: "800" }}>[제 물건이에요]</Text>를 누른 물건이에요. 확인하는 동안 이 물건은 목록에서 숨겨져 있어요.</Text>
      {!!error && <Text style={st.error}>{error}</Text>}

      <View style={st.head}>
        <Text style={st.h2}>확인 기다리는 물건</Text>
        {data && <Text style={st.count}>{data.waiting.length}건</Text>}
      </View>

      {!data && !error ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 24 }} />
      ) : data && data.waiting.length === 0 ? (
        <View style={st.emptyBox}>
          <Text style={st.empty}>지금은 확인할 요청이 없어요.</Text>
        </View>
      ) : (
        data?.waiting.map((c) => (
          <View key={c.id} style={st.card}>
            <ItemCard item={c.item} />
            <View style={st.who}>
              <Text style={st.whoLine}>🙋 요청한 사람: <Text style={st.strong}>{c.claimer.name}</Text> ({c.claimer.loginId})</Text>
              <Text style={st.whoLine}>📷 처음 제보한 사람: <Text style={st.strong}>{c.reporter ?? "익명"}</Text></Text>
              <Text style={st.whoLine}>🕒 요청한 때: {timeText(c.claimedAt)}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="✅ 찾음" style={{ flex: 1 }} disabled={busyId === c.id} onPress={() => resolve(c, "found")} />
              <Button title="↩️ 못찾음" kind="line" style={{ flex: 1 }} disabled={busyId === c.id} onPress={() => resolve(c, "notfound")} />
            </View>
          </View>
        ))
      )}

      {!!data?.done.length && (
        <>
          <View style={[st.head, { marginTop: 28 }]}>
            <Text style={st.h2}>최근 처리한 요청</Text>
          </View>
          {data.done.map((c) => (
            <View key={c.id} style={st.doneRow}>
              <Text style={[st.doneBadge, c.status === "찾음" ? { color: C.ok } : { color: C.sub }]}>{c.status}</Text>
              <Text style={st.doneText} numberOfLines={1}>
                {`${c.item.clrNm ?? ""} ${c.item.fdPrdtNm}`.trim()} · {c.claimer.name}
              </Text>
              <Text style={st.doneTime}>{c.resolvedAt ? timeText(c.resolvedAt) : ""}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  lead: { fontSize: F.md, color: C.sub, lineHeight: 24 },
  error: { marginTop: 12, color: "#C62828", fontWeight: "700", fontSize: F.sm },
  head: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 20, marginBottom: 10 },
  h2: { fontSize: F.xl, fontWeight: "800", color: C.ink },
  count: { fontSize: F.md, fontWeight: "800", color: C.brand },
  card: { gap: 10, padding: 12, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginBottom: 14 },
  who: { gap: 4, paddingHorizontal: 4 },
  whoLine: { fontSize: F.sm, color: C.ink2 },
  strong: { fontWeight: "800", color: C.ink },
  emptyBox: { padding: 24, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center" },
  empty: { fontSize: F.md, color: C.sub },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  doneBadge: { width: 48, fontSize: F.sm, fontWeight: "800" },
  doneText: { flex: 1, fontSize: F.sm, color: C.ink },
  doneTime: { fontSize: F.xs, color: C.sub },
});

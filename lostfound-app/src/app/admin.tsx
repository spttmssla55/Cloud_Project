/**
 * 운영자 페이지 (role = admin 만)
 *   이제 [제 물건이에요]는 AI 가 자동으로 확인한다 → 운영자는 상주할 필요 없이 '기록'을 보고 필요할 때만 손댄다
 *   1. 운영 통계: AI 판정 수, 매칭·알림, 지도·사진 준비 현황, 경찰청 수집 상태, 최근 2주
 *   2. 확인 기다리는 물건: AI 를 못 쓸 때(Bedrock 오류)만 여기로 온다 → [✅ 찾음] / [↩️ 못찾음]
 *   3. 최근 처리 기록: AI 가 왜 그렇게 판단했는지(이유·점수·주인이 적은 답) + 잘못 승인했으면 [되돌리기]
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, ItemCard } from "@/components/ui";
import { apiAdminClaims, apiAdminStats, apiReopenClaim, apiResolveClaim } from "@/lib/api";
import { ask, notify } from "@/lib/dialog";
import { timeText } from "@/lib/format";
import { useApp } from "@/lib/store";
import { C, F } from "@/lib/theme";
import type { AdminStats, Claim } from "@/lib/types";

export default function AdminScreen() {
  const isAdmin = useApp((s) => s.user?.role === "admin");
  const [data, setData] = useState<{ waiting: Claim[]; done: Claim[] } | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [c, s] = await Promise.all([apiAdminClaims(), apiAdminStats().catch(() => null)]);
      setData(c);
      setStats(s);
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
    ask(
      result === "found" ? "찾음으로 처리할까요?" : "못찾음으로 처리할까요?",
      result === "found"
        ? `‘${name}’을 주인 찾음으로 바꾸고 목록에서 뺄게요. (기록은 남아요)`
        : `‘${name}’을 다시 목록에 보이게 할게요.`,
      result === "found" ? "찾음" : "못찾음",
      async () => {
        setBusyId(c.id);
        try {
          await apiResolveClaim(c.id, result);
          await load();
        } catch (e) {
          notify("처리하지 못했어요", (e as Error).message);
        } finally {
          setBusyId("");
        }
      },
    );
  }

  function reopen(c: Claim) {
    ask("되돌릴까요?", "AI가 '주인 맞음'으로 처리한 것을 취소하고, 물건을 다시 목록에 보이게 할게요.", "되돌리기", async () => {
      setBusyId(c.id);
      try {
        await apiReopenClaim(c.id);
        await load();
      } catch (e) {
        notify("되돌리지 못했어요", (e as Error).message);
      } finally {
        setBusyId("");
      }
    });
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
      <Text style={st.lead}><Text style={{ fontWeight: "800" }}>[제 물건이에요]</Text>는 AI가 자동으로 확인해요. 여기서는 기록을 보고, AI를 못 쓸 때 온 요청만 처리하면 돼요.</Text>
      {!!error && <Text style={st.error}>{error}</Text>}

      {stats && <StatsBlock s={stats} />}

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
            <Text style={st.h2}>최근 처리 기록</Text>
          </View>
          {data.done.map((c) => (
            <View key={c.id} style={st.doneCard}>
              <View style={st.doneRow}>
                <Text style={[st.doneBadge, c.status === "찾음" ? { color: C.ok } : { color: C.sub }]}>{c.status === "찾음" ? "주인 맞음" : "아님"}</Text>
                <Text style={st.by}>{c.ai?.by === "ai" ? `🤖 AI${c.ai.score != null ? ` ${Math.round(c.ai.score * 100)}점` : ""}` : "👤 운영자"}</Text>
                <Text style={st.doneText} numberOfLines={1}>
                  {`${c.item.clrNm ?? ""} ${c.item.fdPrdtNm}`.trim()} · {c.claimer.name}
                </Text>
                <Text style={st.doneTime}>{c.resolvedAt ? timeText(c.resolvedAt) : ""}</Text>
              </View>
              {!!c.ai?.answer && <Text style={st.aiLine}>💬 주인이 적은 특징: “{c.ai.answer}”</Text>}
              {!!c.ai?.question && <Text style={st.aiLine}>❓ AI 질문: {c.ai.question} → “{c.ai.answer2}”</Text>}
              {!!c.ai?.reason && <Text style={st.aiLine}>🧠 판단 이유: {c.ai.reason}</Text>}
              {c.status === "찾음" && c.ai?.by === "ai" && (
                <Button title="↩️ 되돌리기 (다시 목록에)" kind="line" disabled={busyId === c.id} onPress={() => reopen(c)} />
              )}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function StatsBlock({ s }: { s: AdminStats }) {
  const t = s.totals;
  const boxes: [string, number][] = [
    ["AI 승인", t.ai_ok], ["AI 거절", t.ai_no], ["운영자 처리", t.admin_done],
    ["찾는 중 분실물", t.lost_active], ["찾음 처리", t.lost_found], ["7일 매칭", t.matches_7d],
    ["7일 알림", t.notices_7d], ["푸시 구독", t.push_subs], ["가입자", t.users],
    ["보관 중 습득물", t.live_items], ["지도에 표시", t.on_map], ["사진 임베딩", t.embedded],
  ];
  const max = Math.max(1, ...s.daily.map((d) => Math.max(d.lost, d.found, d.matches)));
  return (
    <View style={{ marginTop: 16, gap: 10 }}>
      <Text style={st.h2}>운영 통계</Text>
      <View style={st.grid}>
        {boxes.map(([k, v]) => (
          <View key={k} style={st.box}>
            <Text style={st.boxV}>{(v ?? 0).toLocaleString()}</Text>
            <Text style={st.boxK}>{k}</Text>
          </View>
        ))}
      </View>
      <View style={st.chart}>
        <Text style={st.chartTitle}>최근 2주 · <Text style={{ color: "#E08600" }}>■</Text> 분실 등록 <Text style={{ color: C.brand }}>■</Text> 습득 제보 <Text style={{ color: C.ok }}>■</Text> 매칭</Text>
        <View style={st.cols}>
          {s.daily.map((d) => (
            <View key={d.day} style={st.col}>
              <View style={st.colBars}>
                {[[d.lost, "#E08600"], [d.found, C.brand], [d.matches, C.ok]].map(([v, c], i) => (
                  <View key={i} style={{ width: 4, height: Math.max(2, ((v as number) / max) * 80), backgroundColor: c as string, borderRadius: 2 }} />
                ))}
              </View>
              <Text style={st.colLabel}>{d.day.slice(8)}</Text>
            </View>
          ))}
        </View>
      </View>
      {s.sync.map((x) => (
        <Text key={x.source} style={st.sync}>
          📥 {x.source === "portal" ? "포털기관" : "경찰청"} 수집: {x.lastRunAt ? timeText(x.lastRunAt) : "아직"} · {x.lastDate ?? "-"}까지
          {x.error ? `  ⚠️ ${x.error.slice(0, 60)}` : ""}
        </Text>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  box: { width: "31.5%", padding: 10, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  boxV: { fontSize: F.lg, fontWeight: "800", color: C.ink },
  boxK: { fontSize: F.xs, color: C.sub },
  chart: { padding: 12, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, gap: 8 },
  chartTitle: { fontSize: F.xs, color: C.sub },
  cols: { flexDirection: "row", alignItems: "flex-end", height: 100 },
  col: { flex: 1, alignItems: "center", gap: 3 },
  colBars: { flexDirection: "row", alignItems: "flex-end", gap: 1, height: 82 },
  colLabel: { fontSize: 9, color: C.sub },
  sync: { fontSize: F.xs, color: C.ink2 },
  doneCard: { gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  by: { fontSize: F.xs, fontWeight: "700", color: C.brandDark },
  aiLine: { fontSize: F.xs, color: C.ink2, lineHeight: 18 },
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
  doneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  doneBadge: { width: 64, fontSize: F.sm, fontWeight: "800" },
  doneText: { flex: 1, fontSize: F.sm, color: C.ink },
  doneTime: { fontSize: F.xs, color: C.sub },
});

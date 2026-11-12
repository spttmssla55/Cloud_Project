/**
 * 마이페이지: 로그인 / 알림 / 내가 등록한 습득물 / 내가 잃어버린 물건
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LoginForm } from "@/components/auth";
import { Button, ItemCard } from "@/components/ui";
import { IS_MOCK } from "@/lib/api";
import { localYmd, relDate, timeText } from "@/lib/format";
import { logout, markLostFound, readAllNotices, refreshMe, useApp } from "@/lib/store";
import { C, F } from "@/lib/theme";
import type { LostItem } from "@/lib/types";

export default function MyScreen() {
  const user = useApp((s) => s.user);
  // 로그인 안 했으면 로그인 폼 (아래에 회원가입 · 아이디 찾기 · 비밀번호 찾기)
  return user ? <MyPage /> : <LoginForm />;
}

/* ───── 마이페이지 ───── */
function MyPage() {
  const user = useApp((s) => s.user)!;
  const notices = useApp((s) => s.notices);
  const lost = useApp((s) => s.lost);
  const myItems = useApp((s) => s.myItems);
  const meError = useApp((s) => s.meError);
  const unread = notices.filter((n) => !n.read).length;

  // 화면에 들어올 때마다 서버에서 새로 가져오기 (새 알림 확인)
  useFocusEffect(
    useCallback(() => {
      refreshMe();
    }, []),
  );

  // 마이페이지를 보면 알림을 읽은 것으로 처리 (조금 뒤에, 새 알림 표시를 한 번은 보게)
  useFocusEffect(
    useCallback(() => {
      if (!unread) return;
      const t = setTimeout(readAllNotices, 2500);
      return () => clearTimeout(t);
    }, [unread]),
  );

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* 프로필 */}
      <View style={st.profile}>
        <View style={st.avatar}>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>{user.name.slice(0, 1)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.name}>{user.name}님</Text>
          <Text style={st.email}>아이디 {user.loginId}</Text>
        </View>
        <Pressable onPress={() => Alert.alert("로그아웃할까요?", undefined, [{ text: "취소", style: "cancel" }, { text: "로그아웃", onPress: logout }])} hitSlop={8}>
          <Text style={{ color: C.sub, fontWeight: "700", fontSize: F.sm }}>로그아웃</Text>
        </Pressable>
      </View>

      {/* 서버에서 못 불러왔으면 이유를 보여 준다 (예전엔 조용히 빈 화면) */}
      {!!meError && (
        <Pressable onPress={() => refreshMe()} style={st.errBox} accessibilityRole="button">
          <Text style={st.errTitle}>마이페이지를 불러오지 못했어요</Text>
          <Text style={st.errText}>{meError}</Text>
          <Text style={st.errRetry}>눌러서 다시 시도 ↻</Text>
        </Pressable>
      )}

      {/* 운영자만: 운영자 페이지 */}
      {user.role === "admin" && (
        <Pressable onPress={() => router.push("/admin")} style={({ pressed }) => [st.adminCard, pressed && { opacity: 0.8 }]} accessibilityRole="button">
          <Text style={st.adminTitle}>🛠 운영자 페이지</Text>
          <Text style={st.adminSub}>[제 물건이에요] 요청을 확인하고 찾음 / 못찾음으로 처리해요 ›</Text>
        </Pressable>
      )}

      {/* 알림 */}
      <Section title="알림" count={unread ? `새 알림 ${unread}` : undefined}>
        {notices.length === 0 ? (
          <Empty text="아직 알림이 없어요. 잃어버린 물건과 비슷한 습득물이 등록되면 여기에 알려 드려요." />
        ) : (
          notices.slice(0, 5).map((n) => (
            <Pressable
              key={n.id}
              onPress={() => router.push({ pathname: "/item/[id]", params: { id: n.itemId, sn: "1" } })}
              style={[st.notice, !n.read && { borderColor: C.brand, backgroundColor: C.brandSoft }]}
            >
              <Text style={{ fontSize: 20 }}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.noticeText}>{n.text}</Text>
                <Text style={st.small}>{timeText(n.at)}</Text>
              </View>
              <Text style={{ color: C.faint, fontSize: 20 }}>›</Text>
            </Pressable>
          ))
        )}
      </Section>

      {/* 잃어버린 물건 */}
      <Section title="잃어버린 물건" count={`${lost.length}건`}>
        {lost.length === 0 ? (
          <Empty text="챗봇에 “잃어버렸어요”라고 물어보면 여기에 등록돼요." action="챗봇에게 물어보기" onAction={() => router.push({ pathname: "/chat", params: { start: "lost" } })} />
        ) : (
          lost.map((l) => <LostCard key={l.id} lost={l} />)
        )}
      </Section>

      {/* 내가 등록한 습득물 */}
      <Section title="내가 등록한 습득물" count={`${myItems.length}건`}>
        {myItems.length === 0 ? (
          <Empty text="주운 물건을 챗봇으로 등록하면 여기에 모여요." action="주운 물건 등록하기" onAction={() => router.push({ pathname: "/chat", params: { start: "found" } })} />
        ) : (
          myItems.map((it) => <ItemCard key={it.atcId} item={it} />)
        )}
      </Section>
    </ScrollView>
  );
}

function LostCard({ lost }: { lost: LostItem }) {
  const [open, setOpen] = useState(false);
  const matches = lost.matches ?? [];
  const done = lost.status === "찾음";
  return (
    <View style={[st.lost, done && { opacity: 0.6 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={st.lostTitle}>{lost.color} {lost.kind}</Text>
        <View style={[st.pill, { backgroundColor: done ? C.okSoft : C.reportSoft }]}>
          <Text style={{ fontSize: F.xs, fontWeight: "700", color: done ? C.ok : C.report }}>{lost.status}</Text>
        </View>
      </View>
      <Text style={st.lostSub}>📍 {lost.place} · {relDate(localYmd(new Date(lost.createdAt)))} 등록</Text>
      {lost.features.length > 0 && <Text style={st.lostSub}>특징: {lost.features.join(", ")}</Text>}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        <Button title={matches.length ? `비슷한 물건 ${matches.length}건 ${open ? "접기" : "보기"}` : "아직 비슷한 물건 없음"} kind="line" disabled={!matches.length} onPress={() => setOpen(!open)} style={{ flex: 1, minHeight: 44 }} />
        {!done && <Button title="찾았어요" onPress={() => markLostFound(lost.id)} style={{ minHeight: 44 }} />}
      </View>
      {open && <View style={{ gap: 8, marginTop: 10 }}>{matches.map((it) => <ItemCard key={it.atcId} item={it} />)}</View>}
    </View>
  );
}

function Section({ title, count, children }: { title: string; count?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={st.h2}>{title}</Text>
        {count && <Text style={{ color: C.brand, fontWeight: "700", fontSize: F.sm }}>{count}</Text>}
      </View>
      {children}
    </View>
  );
}

function Empty({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={st.empty}>
      <Text style={st.emptyText}>{text}</Text>
      {action && <Button title={action} kind="line" onPress={onAction} style={{ marginTop: 12, minHeight: 44 }} />}
    </View>
  );
}

const st = StyleSheet.create({
  errBox: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: "#FDECEC", borderWidth: 1, borderColor: "#F3B5B5", gap: 4 },
  errTitle: { fontSize: F.md, fontWeight: "800", color: "#B71C1C" },
  errText: { fontSize: F.sm, color: "#7F1D1D" },
  errRetry: { fontSize: F.sm, fontWeight: "700", color: "#B71C1C", marginTop: 4 },
  adminCard: { marginTop: 14, padding: 16, borderRadius: 18, backgroundColor: C.brand, gap: 4 },
  adminTitle: { color: "#fff", fontSize: F.lg, fontWeight: "800" },
  adminSub: { color: "#fff", opacity: 0.9, fontSize: F.sm },
  h1: { fontSize: F.xxl, fontWeight: "800", color: C.ink },
  lead: { fontSize: F.md, color: C.sub, marginTop: 8, lineHeight: 25 },
  form: { marginTop: 22, gap: 14, padding: 18, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line },
  label: { fontSize: F.sm, color: C.sub, fontWeight: "600" },
  input: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, fontSize: F.md, color: C.ink, backgroundColor: C.card },
  error: { color: "#C0392B", fontSize: F.sm, fontWeight: "600" },
  hint: { color: C.sub, fontSize: F.xs, textAlign: "center" },
  mock: { fontSize: F.xs, color: C.sub, marginTop: 12, textAlign: "center", lineHeight: 19 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  name: { fontSize: F.lg, fontWeight: "800", color: C.ink },
  email: { fontSize: F.sm, color: C.sub },
  h2: { fontSize: F.xl, fontWeight: "800", color: C.ink },
  notice: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  noticeText: { fontSize: F.md, color: C.ink, lineHeight: 23, fontWeight: "600" },
  small: { fontSize: F.xs, color: C.sub, marginTop: 3 },
  lost: { padding: 16, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  lostTitle: { fontSize: F.lg, fontWeight: "800", color: C.ink },
  lostSub: { fontSize: F.sm, color: C.ink2, marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  empty: { padding: 18, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  emptyText: { fontSize: F.sm, color: C.sub, lineHeight: 22, textAlign: "center" },
});

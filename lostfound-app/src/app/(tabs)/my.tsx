/**
 * 마이페이지: 로그인 / 알림 / 내가 등록한 습득물 / 내가 잃어버린 물건
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, ItemCard } from "@/components/ui";
import { IS_MOCK } from "@/lib/api";
import { localYmd, relDate, timeText } from "@/lib/format";
import { MOCK_ITEMS } from "@/lib/mock-data";
import { login, logout, markLostFound, readAllNotices, useApp } from "@/lib/store";
import { C, F } from "@/lib/theme";
import type { LostItem } from "@/lib/types";

export default function MyScreen() {
  const user = useApp((s) => s.user);
  return user ? <MyPage /> : <LoginForm />;
}

/* ───── 로그인 ───── */
function LoginForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const ok = /\S+@\S+\.\S+/.test(email) && pw.length >= 4;

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <Text style={st.h1}>로그인</Text>
      <Text style={st.lead}>로그인하면 내가 등록한 습득물과 잃어버린 물건을 모아 보고, 비슷한 물건이 들어오면 알림을 받을 수 있어요.</Text>

      <View style={st.form}>
        <Field label="이름 (선택)" value={name} onChangeText={setName} placeholder="예: 백승범" />
        <Field label="이메일" value={email} onChangeText={setEmail} placeholder="example@email.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="비밀번호" value={pw} onChangeText={setPw} placeholder="4자 이상" secureTextEntry />
        <Button title="로그인" disabled={!ok} onPress={() => login(name, email)} style={{ marginTop: 6 }} />
      </View>
      {IS_MOCK && <Text style={st.mock}>지금은 예시 로그인이에요. 서버를 연결하면 실제 계정으로 로그인돼요.</Text>}
    </ScrollView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={st.label}>{label}</Text>
      <TextInput {...props} placeholderTextColor={C.faint} style={st.input} accessibilityLabel={label} />
    </View>
  );
}

/* ───── 마이페이지 ───── */
function MyPage() {
  const user = useApp((s) => s.user)!;
  const notices = useApp((s) => s.notices);
  const lost = useApp((s) => s.lost);
  const myIds = useApp((s) => s.myFoundIds);
  const myItems = MOCK_ITEMS.filter((it) => myIds.includes(it.atcId));
  const unread = notices.filter((n) => !n.read).length;

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
          <Text style={st.email}>{user.email}</Text>
        </View>
        <Pressable onPress={() => Alert.alert("로그아웃할까요?", undefined, [{ text: "취소", style: "cancel" }, { text: "로그아웃", onPress: logout }])} hitSlop={8}>
          <Text style={{ color: C.sub, fontWeight: "700", fontSize: F.sm }}>로그아웃</Text>
        </Pressable>
      </View>

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
  const matches = MOCK_ITEMS.filter((it) => lost.matchIds.includes(it.atcId));
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
  h1: { fontSize: F.xxl, fontWeight: "800", color: C.ink },
  lead: { fontSize: F.md, color: C.sub, marginTop: 8, lineHeight: 25 },
  form: { marginTop: 22, gap: 14, padding: 18, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line },
  label: { fontSize: F.sm, color: C.sub, fontWeight: "600" },
  input: { minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, fontSize: F.md, color: C.ink, backgroundColor: C.card },
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

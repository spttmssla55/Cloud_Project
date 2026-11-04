/**
 * 로그인·회원가입·찾기 화면이 같이 쓰는 부품
 *   Field      제목 + 입력칸 + (아래) 안내/에러 한 줄
 *   CheckRow   입력칸 + [중복 확인] 버튼
 *   LoginForm  로그인 폼 (마이페이지와 /auth/login 화면에서 같이 씀)
 */
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui";
import { IS_MOCK } from "@/lib/api";
import { login } from "@/lib/store";
import { C, F } from "@/lib/theme";

type Tone = "info" | "ok" | "error";

export function Field({
  label,
  note,
  tone = "info",
  right,
  ...props
}: { label: string; note?: string; tone?: Tone; right?: React.ReactNode } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={st.label}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          {...props}
          placeholderTextColor={C.faint}
          autoCorrect={false}
          style={[st.input, tone === "error" && !!note && { borderColor: ERR }, { flex: 1, minWidth: 0 }]}
          accessibilityLabel={label}
        />
        {right}
      </View>
      {!!note && <Text style={[st.note, tone === "ok" && { color: C.ok }, tone === "error" && { color: ERR }]}>{note}</Text>}
    </View>
  );
}

/** 비밀번호 칸: 👁 눌러서 보이기/숨기기 */
export function PasswordField(props: Omit<React.ComponentProps<typeof Field>, "secureTextEntry" | "right">) {
  const [show, setShow] = useState(false);
  return (
    <Field
      {...props}
      secureTextEntry={!show}
      autoCapitalize="none"
      right={
        <Pressable onPress={() => setShow(!show)} style={st.sideBtn} accessibilityRole="button" accessibilityLabel={show ? "비밀번호 숨기기" : "비밀번호 보기"}>
          <Text style={st.sideText}>{show ? "숨기기" : "보기"}</Text>
        </Pressable>
      }
    />
  );
}

export function SideButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[st.sideBtn, disabled && { opacity: 0.4 }]} accessibilityRole="button">
      <Text style={st.sideText}>{title}</Text>
    </Pressable>
  );
}

/** 아래쪽 글자 링크 줄: 회원가입 | 아이디 찾기 | 비밀번호 찾기 */
export function LinkRow({ links }: { links: { label: string; href: "/auth/signup" | "/auth/find-id" | "/auth/find-password" | "/auth/login" }[] }) {
  return (
    <View style={st.links}>
      {links.map((l, i) => (
        <View key={l.href} style={{ flexDirection: "row", alignItems: "center" }}>
          {i > 0 && <Text style={st.bar}>|</Text>}
          <Pressable onPress={() => router.push(l.href)} hitSlop={8} accessibilityRole="link">
            <Text style={st.link}>{l.label}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export function LoginForm({ onDone }: { onDone?: () => void }) {
  const [loginId, setLoginId] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ok = loginId.trim().length >= 4 && pw.length >= 1;

  async function submit() {
    if (!ok || busy) return;
    setBusy(true);
    setError("");
    try {
      await login(loginId, pw);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={st.h1}>로그인</Text>
      <Text style={st.lead}>로그인하면 잃어버린 물건을 등록해 두고, 비슷한 물건이 들어오면 알림을 받을 수 있어요.</Text>

      <View style={st.form}>
        <Field label="아이디" value={loginId} onChangeText={setLoginId} placeholder="아이디" autoCapitalize="none" returnKeyType="next" />
        <PasswordField label="비밀번호" value={pw} onChangeText={setPw} placeholder="비밀번호" returnKeyType="go" onSubmitEditing={submit} />
        {!!error && <Text style={st.error}>{error}</Text>}
        <Button title={busy ? "로그인 중…" : "로그인"} disabled={!ok || busy} onPress={submit} style={{ marginTop: 4 }} />
        <LinkRow
          links={[
            { label: "회원가입", href: "/auth/signup" },
            { label: "아이디 찾기", href: "/auth/find-id" },
            { label: "비밀번호 찾기", href: "/auth/find-password" },
          ]}
        />
      </View>
      {IS_MOCK && <Text style={st.mock}>지금은 예시 로그인이에요. 서버를 연결하면 실제 계정으로 로그인돼요.</Text>}
    </ScrollView>
  );
}

const ERR = "#C62828";

export const st = StyleSheet.create({
  h1: { fontSize: F.xxl, fontWeight: "800", color: C.ink },
  lead: { fontSize: F.md, color: C.sub, marginTop: 8, lineHeight: 25 },
  form: { marginTop: 22, gap: 16, padding: 18, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  label: { fontSize: F.sm, fontWeight: "700", color: C.ink2 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg, paddingHorizontal: 14, fontSize: F.md, color: C.ink },
  note: { fontSize: F.sm, color: C.sub, lineHeight: 21 },
  error: { fontSize: F.sm, color: ERR, fontWeight: "700", lineHeight: 21 },
  sideBtn: { flexShrink: 0, minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, justifyContent: "center" },
  sideText: { fontSize: F.sm, fontWeight: "700", color: C.ink2 },
  links: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 4, flexWrap: "wrap" },
  link: { fontSize: F.sm, fontWeight: "700", color: C.ink2, paddingHorizontal: 4 },
  bar: { color: C.line, marginHorizontal: 8, fontSize: F.sm },
  mock: { fontSize: F.xs, color: C.sub, marginTop: 14, textAlign: "center" },
  doneBox: { marginTop: 22, padding: 20, borderRadius: 20, backgroundColor: C.okSoft, borderWidth: 1, borderColor: C.ok, gap: 8, alignItems: "center" },
  doneBig: { fontSize: F.xl, fontWeight: "800", color: C.ink, letterSpacing: 1 },
});

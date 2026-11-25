/**
 * 회원가입: 닉네임 · 아이디 · 비밀번호 · 비밀번호 확인 + 이메일 인증
 *   닉네임·아이디는 [중복 확인]을 눌러야 가입 버튼이 켜진다 (글자를 바꾸면 다시 확인)
 *   이메일: 실제 메일함으로 인증번호 6자리 (AWS SES) → 아이디·비밀번호 찾기, 알림 메일에 씀
 */
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { EmailVerify, Field, LinkRow, PasswordField, SideButton, st } from "@/components/auth";
import { Button } from "@/components/ui";
import { apiCheck, IS_MOCK } from "@/lib/api";
import { signup } from "@/lib/store";
import { C } from "@/lib/theme";

const ID_RE = /^[a-z0-9_]{4,20}$/;
const NICK_RE = /^[가-힣A-Za-z0-9_]{2,10}$/;

type Check = { state: "none" | "checking" | "ok" | "taken" | "error"; msg: string };

export default function SignupScreen() {
  const [nickname, setNickname] = useState("");
  const [loginId, setLoginId] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [emailToken, setEmailToken] = useState("");
  const [nickCheck, setNickCheck] = useState<Check>({ state: "none", msg: "" });
  const [idCheck, setIdCheck] = useState<Check>({ state: "none", msg: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 규칙 검사 (입력하는 대로 바로 안내)
  const nickRule = !nickname ? "" : NICK_RE.test(nickname.trim()) ? "" : "한글·영어·숫자로 2~10자 (띄어쓰기 안 돼요)";
  const idRule = !loginId ? "" : ID_RE.test(loginId) ? "" : "영어 소문자·숫자·밑줄(_)로 4~20자";
  const pwRule = !pw ? "" : pw.length < 8 || pw.length > 30 ? "8~30자로 만들어 주세요" : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? "영어와 숫자를 섞어 주세요" : "";
  const pw2Rule = !pw2 ? "" : pw2 === pw ? "" : "비밀번호가 달라요";

  async function check(kind: "nickname" | "loginId") {
    const set = kind === "nickname" ? setNickCheck : setIdCheck;
    if (IS_MOCK) return set({ state: "ok", msg: "사용할 수 있어요. (예시)" });
    set({ state: "checking", msg: "확인 중…" });
    try {
      const r = await apiCheck(kind === "nickname" ? { nickname: nickname.trim() } : { loginId });
      set({ state: r.available ? "ok" : "taken", msg: r.message });
    } catch (e) {
      set({ state: "error", msg: (e as Error).message });
    }
  }

  const ready =
    nickCheck.state === "ok" && idCheck.state === "ok" && !!pw && !pwRule && pw2 === pw && (!!emailToken || IS_MOCK) && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      await signup({ nickname, loginId, password: pw, password2: pw2, emailToken });
      router.dismissTo("/my");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const note = (c: Check, rule: string, fallback: string) =>
    rule ? { note: rule, tone: "error" as const } : c.state !== "none" ? { note: c.msg, tone: c.state === "ok" ? ("ok" as const) : ("error" as const) } : { note: fallback, tone: "info" as const };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Text style={st.h1}>회원가입</Text>
      <Text style={st.lead}>가입하면 잃어버린 물건을 등록하고, 비슷한 물건이 들어올 때 알림을 받을 수 있어요.</Text>

      <View style={st.form}>
        <Field
          label="닉네임"
          value={nickname}
          onChangeText={(v) => { setNickname(v); setNickCheck({ state: "none", msg: "" }); }}
          placeholder="예: 승범"
          maxLength={10}
          {...note(nickCheck, nickRule, "다른 사람에게 보이는 이름이에요.")}
          right={<SideButton title="중복 확인" disabled={!nickname || !!nickRule || nickCheck.state === "checking"} onPress={() => check("nickname")} />}
        />
        <Field
          label="아이디"
          value={loginId}
          onChangeText={(v) => { setLoginId(v.toLowerCase()); setIdCheck({ state: "none", msg: "" }); }}
          placeholder="영어 소문자·숫자 4~20자"
          autoCapitalize="none"
          maxLength={20}
          {...note(idCheck, idRule, "로그인할 때 쓰는 아이디예요.")}
          right={<SideButton title="중복 확인" disabled={!loginId || !!idRule || idCheck.state === "checking"} onPress={() => check("loginId")} />}
        />
        <PasswordField
          label="비밀번호"
          value={pw}
          onChangeText={setPw}
          placeholder="영어+숫자 8~30자"
          maxLength={30}
          note={pwRule || (pw ? "사용할 수 있는 비밀번호예요." : "영어와 숫자를 섞어 8자 이상")}
          tone={pwRule ? "error" : pw ? "ok" : "info"}
        />
        <PasswordField
          label="비밀번호 확인"
          value={pw2}
          onChangeText={setPw2}
          placeholder="비밀번호를 한 번 더"
          maxLength={30}
          note={pw2Rule || (pw2 ? "비밀번호가 같아요." : "")}
          tone={pw2Rule ? "error" : "ok"}
        />

        {/* 이메일 인증 (실제 있는 메일로만 가입 — 아이디·비밀번호 찾기와 알림 메일에도 써요) */}
        <EmailVerify purpose="signup" onVerified={(r) => setEmailToken(r?.emailToken ?? "")} />

        {!!error && <Text style={st.error}>{error}</Text>}
        <Button title={busy ? "가입하는 중…" : "가입하기"} disabled={!ready} onPress={submit} />
        {!ready && <Text style={[st.note, { textAlign: "center" }]}>닉네임·아이디 <Text style={{ fontWeight: "700" }}>중복 확인</Text>과 <Text style={{ fontWeight: "700" }}>이메일 인증</Text>까지 하면 가입 버튼이 켜져요.</Text>}
        <LinkRow links={[{ label: "이미 계정이 있어요 · 로그인", href: "/auth/login" }]} />
      </View>
    </ScrollView>
  );
}

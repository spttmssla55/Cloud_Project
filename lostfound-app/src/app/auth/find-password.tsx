/**
 * 비밀번호 찾기
 *   기본: 가입한 이메일 → 인증번호 → 새 비밀번호 두 번 (아이디를 몰라도 됨)
 *   예전 계정: 아이디 → 질문 → 답 + 새 비밀번호 두 번
 *   (원래 비밀번호는 DB 에 해시로만 있어서 '알려 줄' 수 없다 → 새로 정하는 방식)
 */
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { EmailVerify, Field, PasswordField, st } from "@/components/auth";
import { Button } from "@/components/ui";
import { apiQuestion, apiResetPassword, IS_MOCK } from "@/lib/api";
import { C } from "@/lib/theme";

function QuestionFindPassword() {
  const [loginId, setLoginId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pwRule = !pw ? "" : pw.length < 8 || pw.length > 30 ? "8~30자로 만들어 주세요" : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? "영어와 숫자를 섞어 주세요" : "";
  const ready = !!answer.trim() && !!pw && !pwRule && pw === pw2 && !busy;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const next = () =>
    run(async () => {
      if (IS_MOCK) throw new Error("서버를 연결해야 쓸 수 있어요.");
      setQuestion((await apiQuestion({ loginId: loginId.trim().toLowerCase() })).question);
    });
  const submit = () =>
    run(async () => {
      await apiResetPassword({ loginId: loginId.trim().toLowerCase(), answer, password: pw, password2: pw2 });
      setDone(true);
    });

  return (
    <>
      <Text style={st.lead}>예전에 이메일 없이 가입했다면, 아이디와 가입할 때 정한 질문의 답으로 확인해요.</Text>

      {done ? (
        <View style={st.doneBox}>
          <Text style={st.doneBig}>비밀번호를 바꿨어요</Text>
          <Text style={[st.note, { textAlign: "center" }]}>새 비밀번호로 로그인해 주세요.</Text>
          <Button title="로그인하러 가기" onPress={() => router.dismissTo("/my")} style={{ alignSelf: "stretch", marginTop: 8 }} />
        </View>
      ) : (
        <View style={st.form}>
          <Field label="아이디" value={loginId} onChangeText={(v) => { setLoginId(v.toLowerCase()); setQuestion(""); }} placeholder="가입한 아이디" autoCapitalize="none" editable={!question} />
          {!!question && (
            <>
              <View style={{ gap: 6 }}>
                <Text style={st.label}>질문</Text>
                <Text style={{ fontSize: 17, fontWeight: "700", color: C.ink }}>{question}</Text>
              </View>
              <Field label="답" value={answer} onChangeText={setAnswer} placeholder="가입할 때 적은 답" />
              <PasswordField label="새 비밀번호" value={pw} onChangeText={setPw} placeholder="영어+숫자 8~30자" maxLength={30} note={pwRule} tone="error" />
              <PasswordField
                label="새 비밀번호 확인"
                value={pw2}
                onChangeText={setPw2}
                placeholder="한 번 더"
                maxLength={30}
                note={pw2 ? (pw2 === pw ? "비밀번호가 같아요." : "비밀번호가 달라요") : ""}
                tone={pw2 && pw2 !== pw ? "error" : "ok"}
              />
            </>
          )}
          {!!error && <Text style={st.error}>{error}</Text>}
          {question ? (
            <Button title={busy ? "바꾸는 중…" : "비밀번호 바꾸기"} disabled={!ready} onPress={submit} />
          ) : (
            <Button title={busy ? "확인 중…" : "다음"} disabled={loginId.trim().length < 4 || busy} onPress={next} />
          )}
          {!!question && <Button title="아이디 다시 적기" kind="line" onPress={() => { setQuestion(""); setAnswer(""); }} />}
        </View>
      )}
    </>
  );
}

const PW_RULE = (pw: string) =>
  !pw ? "" : pw.length < 8 || pw.length > 30 ? "8~30자로 만들어 주세요" : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? "영어와 숫자를 섞어 주세요" : "";

/** 이메일로: 인증 → 새 비밀번호 */
function EmailFindPassword() {
  const [token, setToken] = useState("");
  const [loginId, setLoginId] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pwRule = PW_RULE(pw);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await apiResetPassword({ emailToken: token, password: pw, password2: pw2 });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <View style={st.doneBox}>
        <Text style={st.doneBig}>비밀번호를 바꿨어요</Text>
        <Text style={[st.note, { textAlign: "center" }]}>아이디 {loginId} 로 새 비밀번호를 써서 로그인해 주세요.</Text>
        <Button title="로그인하러 가기" onPress={() => router.dismissTo("/my")} style={{ alignSelf: "stretch", marginTop: 8 }} />
      </View>
    );
  return (
    <>
      <Text style={st.lead}>가입한 이메일로 인증번호를 받고, 비밀번호를 새로 정해요. 아이디를 몰라도 돼요.</Text>
      <View style={st.form}>
        <EmailVerify purpose="find" label="가입한 이메일" onVerified={(r) => { setToken(r?.emailToken ?? ""); setLoginId(r?.loginId ?? ""); }} />
        {!!token && (
          <>
            <Text style={st.note}>아이디: <Text style={{ fontWeight: "800", color: C.ink }}>{loginId}</Text></Text>
            <PasswordField label="새 비밀번호" value={pw} onChangeText={setPw} placeholder="영어+숫자 8~30자" maxLength={30} note={pwRule} tone="error" />
            <PasswordField
              label="새 비밀번호 확인"
              value={pw2}
              onChangeText={setPw2}
              placeholder="한 번 더"
              maxLength={30}
              note={pw2 ? (pw2 === pw ? "비밀번호가 같아요." : "비밀번호가 달라요") : ""}
              tone={pw2 && pw2 !== pw ? "error" : "ok"}
            />
            {!!error && <Text style={st.error}>{error}</Text>}
            <Button title={busy ? "바꾸는 중…" : "비밀번호 바꾸기"} disabled={!pw || !!pwRule || pw !== pw2 || busy} onPress={submit} />
          </>
        )}
      </View>
    </>
  );
}

export default function FindPasswordScreen() {
  const [old, setOld] = useState(false);
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={st.h1}>비밀번호 찾기</Text>
      {old ? <QuestionFindPassword /> : <EmailFindPassword />}
      <Pressable onPress={() => setOld(!old)} hitSlop={8} style={{ marginTop: 16, alignSelf: "center" }} accessibilityRole="link">
        <Text style={st.link}>{old ? "← 이메일로 찾기" : "이메일 없이 가입한 예전 계정이에요 (찾기 질문으로)"}</Text>
      </Pressable>
    </ScrollView>
  );
}

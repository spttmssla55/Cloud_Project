/**
 * 아이디 찾기
 *   기본: 가입한 이메일 → 메일로 온 인증번호 → 아이디 (메일 주인이 확인됐으니 가리지 않고 보여 줌)
 *   예전 계정(이메일 없이 '찾기 질문'으로 가입): 닉네임 → 질문 → 답 → 가린 아이디 (예: spt**55)
 */
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { EmailVerify, Field, LinkRow, st } from "@/components/auth";
import { Button } from "@/components/ui";
import { apiFindId, apiQuestion, IS_MOCK } from "@/lib/api";
import { C } from "@/lib/theme";

function QuestionFindId() {
  const [nickname, setNickname] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [found, setFound] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      setQuestion((await apiQuestion({ nickname: nickname.trim() })).question);
    });
  const submit = () => run(async () => setFound((await apiFindId(nickname.trim(), answer)).loginId));

  return (
    <>
      <Text style={st.lead}>예전에 이메일 없이 가입했다면, 닉네임과 가입할 때 정한 질문의 답으로 찾아요.</Text>

      {found ? (
        <View style={st.doneBox}>
          <Text style={st.note}>{nickname}님의 아이디는</Text>
          <Text style={st.doneBig}>{found}</Text>
          <Text style={[st.note, { textAlign: "center" }]}>개인정보 보호를 위해 일부를 가렸어요.</Text>
          <Button title="로그인하러 가기" onPress={() => router.dismissTo("/my")} style={{ alignSelf: "stretch", marginTop: 8 }} />
          <LinkRow links={[{ label: "비밀번호도 잊었어요", href: "/auth/find-password" }]} />
        </View>
      ) : (
        <View style={st.form}>
          <Field label="닉네임" value={nickname} onChangeText={(v) => { setNickname(v); setQuestion(""); }} placeholder="가입할 때 정한 닉네임" editable={!question} />
          {!!question && (
            <>
              <View style={{ gap: 6 }}>
                <Text style={st.label}>질문</Text>
                <Text style={{ fontSize: 17, fontWeight: "700", color: C.ink }}>{question}</Text>
              </View>
              <Field label="답" value={answer} onChangeText={setAnswer} placeholder="가입할 때 적은 답" returnKeyType="go" onSubmitEditing={submit} />
            </>
          )}
          {!!error && <Text style={st.error}>{error}</Text>}
          {question ? (
            <Button title={busy ? "찾는 중…" : "아이디 찾기"} disabled={!answer.trim() || busy} onPress={submit} />
          ) : (
            <Button title={busy ? "확인 중…" : "다음"} disabled={nickname.trim().length < 2 || busy} onPress={next} />
          )}
          {!!question && <Button title="닉네임 다시 적기" kind="line" onPress={() => { setQuestion(""); setAnswer(""); }} />}
        </View>
      )}
    </>
  );
}

export default function FindIdScreen() {
  const [old, setOld] = useState(false);
  const [found, setFound] = useState<{ email: string; loginId: string } | null>(null);
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={st.h1}>아이디 찾기</Text>
      {old ? (
        <QuestionFindId />
      ) : found ? (
        <View style={st.doneBox}>
          <Text style={st.note}>{found.email} 로 가입한 아이디는</Text>
          <Text style={st.doneBig}>{found.loginId}</Text>
          <Button title="로그인하러 가기" onPress={() => router.dismissTo("/my")} style={{ alignSelf: "stretch", marginTop: 8 }} />
          <LinkRow links={[{ label: "비밀번호도 잊었어요", href: "/auth/find-password" }]} />
        </View>
      ) : (
        <>
          <Text style={st.lead}>가입할 때 인증한 이메일로 인증번호를 받으면 아이디를 바로 알려 드려요.</Text>
          <View style={st.form}>
            <EmailVerify purpose="find" label="가입한 이메일" onVerified={(r) => r && setFound({ email: r.email, loginId: r.loginId ?? "" })} />
          </View>
        </>
      )}
      <Pressable onPress={() => setOld(!old)} hitSlop={8} style={{ marginTop: 16, alignSelf: "center" }} accessibilityRole="link">
        <Text style={st.link}>{old ? "← 이메일로 찾기" : "이메일 없이 가입한 예전 계정이에요 (찾기 질문으로)"}</Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * 아이디 찾기: 닉네임 → (가입 때 고른) 질문 → 답 → 가린 아이디 (예: spt**55)
 */
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Field, LinkRow, st } from "@/components/auth";
import { Button } from "@/components/ui";
import { apiFindId, apiQuestion, IS_MOCK } from "@/lib/api";
import { C } from "@/lib/theme";

export default function FindIdScreen() {
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
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={st.h1}>아이디 찾기</Text>
      <Text style={st.lead}>닉네임과 가입할 때 정한 질문의 답으로 아이디를 찾아요.</Text>

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
    </ScrollView>
  );
}

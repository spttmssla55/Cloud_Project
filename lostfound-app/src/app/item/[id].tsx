/**
 * 상세 화면: 맨 위에 "지금 어디 있는지"를 가장 크게
 */
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, SourceBadge, StatusBadge, Thumb } from "@/components/ui";
import { getItem } from "@/lib/api";
import { relDate, timeText } from "@/lib/format";
import { C, F } from "@/lib/theme";
import type { FoundItemDetail } from "@/lib/types";

export default function ItemScreen() {
  const { id, sn } = useLocalSearchParams<{ id: string; sn?: string }>();
  const [item, setItem] = useState<FoundItemDetail | null | undefined>(undefined);

  useEffect(() => {
    getItem(String(id), String(sn ?? "1"))
      .then(setItem)
      .catch(() => setItem(null));
  }, [id, sn]);

  if (item === undefined) return <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  if (item === null) return <Text style={st.missing}>이 습득물을 찾을 수 없어요.</Text>;

  const isUser = item.source === "user";
  const say = (t: string) => Alert.alert(t, "지금은 예시 동작이에요. 서버를 연결하면 실제로 기록돼요.");

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Thumb item={item} size="full" />

      <View style={st.badges}>
        <SourceBadge source={item.source} />
        <StatusBadge status={item.status} />
      </View>
      <Text style={st.h1}>{item.fdPrdtNm}</Text>
      <Text style={st.sub}>{item.prdtClNm}</Text>

      {/* 가장 중요한 정보 */}
      <View style={st.where}>
        <Text style={st.label}>{isUser ? "지금 물건이 있는 곳" : "보관 장소"}</Text>
        <Text style={st.whereText}>{isUser ? item.currentPlace : item.depPlace}</Text>
        {!isUser && item.tel ? (
          <Button title={`📞 전화하기 ${item.tel}`} style={{ marginTop: 14 }} onPress={() => Linking.openURL(`tel:${item.tel}`)} />
        ) : null}
      </View>

      <View style={st.table}>
        <Row k={isUser ? "발견한 곳" : "습득 장소"} v={isUser ? item.foundPlace : item.fdPlace} />
        <Row k="습득일" v={`${item.fdYmd} (${relDate(item.fdYmd)})${item.fdHor ? ` · ${item.fdHor}시쯤` : ""}`} />
        <Row k="색상" v={item.clrNm} />
        <Row k="특징" v={item.features?.join(", ")} />
        {!isUser && <Row k="보관 기관" v={[item.orgNm, item.fndKeepOrgnSeNm && `(${item.fndKeepOrgnSeNm})`].filter(Boolean).join(" ")} />}
      </View>

      {item.uniq ? (
        <View style={st.note}>
          <Text style={st.label}>안내</Text>
          <Text style={st.noteText}>{item.uniq}</Text>
        </View>
      ) : null}

      {isUser && (
        <View style={{ gap: 8, marginTop: 18 }}>
          <Button title="제 물건이에요" onPress={() => say("주인 확인 요청을 보냈어요")} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="아직 여기 있어요" kind="line" style={{ flex: 1 }} onPress={() => say("아직 있다고 기록했어요")} />
            <Button title="현장에 없어요" kind="line" style={{ flex: 1 }} onPress={() => say("현장에 없다고 기록했어요")} />
          </View>
        </View>
      )}

      {/* 사용자 제보: 이동 기록 (지우지 않고 쌓임) */}
      {isUser && item.sightings?.length ? (
        <View style={{ marginTop: 32 }}>
          <Text style={st.h2}>이동 기록</Text>
          <Text style={st.hint}>같은 물건이라고 확인된 제보가 시간 순서로 쌓여요. 예전 기록은 지워지지 않아요.</Text>
          {item.sightings.map((s, i) => {
            const last = i === item.sightings!.length - 1;
            return (
              <View key={s.at} style={st.step}>
                <View style={st.rail}>
                  <View style={[st.dot, last && { backgroundColor: C.brand }]} />
                  {!last && <View style={st.line} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 20 }}>
                  <Text style={st.time}>
                    {timeText(s.at)}
                    {last ? <Text style={{ color: C.brand }}>  · 최신</Text> : null}
                  </Text>
                  <Text style={st.stepText}>
                    <Text style={{ fontWeight: "700" }}>{s.foundPlace}</Text>에서 발견
                    {s.currentPlace !== s.foundPlace ? (
                      <Text>
                        {" → "}
                        <Text style={{ fontWeight: "700" }}>{s.currentPlace}</Text>(으)로 옮김
                      </Text>
                    ) : null}
                  </Text>
                  <Text style={st.quote}>“{s.note}”</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <View style={st.row}>
      <Text style={st.rowK}>{k}</Text>
      <Text style={st.rowV}>{v}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  missing: { textAlign: "center", marginTop: 40, fontSize: F.md, color: C.ink2 },
  badges: { flexDirection: "row", gap: 6, marginTop: 16 },
  h1: { fontSize: F.xxl, fontWeight: "800", color: C.ink, marginTop: 6 },
  sub: { fontSize: F.md, color: C.sub, marginTop: 2 },
  where: { marginTop: 18, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: C.brand, backgroundColor: C.brandSoft },
  label: { fontSize: F.sm, color: C.sub, fontWeight: "600" },
  whereText: { fontSize: F.xl, fontWeight: "800", color: C.brandDark, marginTop: 4, lineHeight: 30 },
  table: { marginTop: 14, backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  row: { flexDirection: "row", gap: 14, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  rowK: { width: 76, fontSize: F.sm, color: C.sub, fontWeight: "600", paddingTop: 2 },
  rowV: { flex: 1, fontSize: F.md, color: C.ink, lineHeight: 24 },
  note: { marginTop: 14, padding: 16, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.line, gap: 4 },
  noteText: { fontSize: F.sm, color: C.ink2, lineHeight: 22 },
  h2: { fontSize: F.xl, fontWeight: "800", color: C.ink },
  hint: { fontSize: F.sm, color: C.sub, marginTop: 4, marginBottom: 16, lineHeight: 21 },
  step: { flexDirection: "row", gap: 12 },
  rail: { width: 16, alignItems: "center" },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.faint, marginTop: 4 },
  line: { flex: 1, width: 2, backgroundColor: C.line, marginTop: 2 },
  time: { fontSize: F.sm, color: C.sub, fontWeight: "700" },
  stepText: { fontSize: F.md, color: C.ink, marginTop: 2, lineHeight: 24 },
  quote: { fontSize: F.sm, color: C.sub, marginTop: 4 },
});

/**
 * 상세 화면: 맨 위에 "지금 어디 있는지"를 가장 크게
 *   + 보관 기한 D-day (경찰서 물건) · 전화·길찾기·운영 시간
 *   + 지도: 처음 발견한 곳 → 옮긴 곳 → 지금 있는 곳 (이동 경로)
 *   + [제 물건이에요] → AI 본인 확인 (운영자 없이 자동)
 */
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import LeafletMap from "@/components/LeafletMap";
import { Button, SourceBadge, StatusBadge, Thumb } from "@/components/ui";
import { apiClaim, apiReportItem, getItem, IS_MOCK } from "@/lib/api";
import { useApp } from "@/lib/store";
import { ddayText, deadlineOf, directionsUrl, OFFICE_HOURS, relDate, timeText } from "@/lib/format";
import { pathHtml } from "@/lib/mapHtml";
import { C, F } from "@/lib/theme";
import type { ClaimResult, FoundItemDetail } from "@/lib/types";
import { ask, notify } from "@/lib/dialog";

export default function ItemScreen() {
  const { id, sn } = useLocalSearchParams<{ id: string; sn?: string }>();
  const [item, setItem] = useState<FoundItemDetail | null | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const loggedIn = useApp((s) => !!s.user);
  // [제 물건이에요] AI 확인 · [옮겼어요] 입력 칸
  const [panel, setPanel] = useState<"" | "claim" | "move">("");
  const [answer, setAnswer] = useState("");
  const [claim, setClaim] = useState<ClaimResult | null>(null);
  const [movePlace, setMovePlace] = useState("");

  const load = () =>
    getItem(String(id), String(sn ?? "1"))
      .then(setItem)
      .catch(() => setItem(null));
  useEffect(() => {
    load();
  }, [id, sn]); // eslint-disable-line react-hooks/exhaustive-deps

  const path = item?.path ?? [];
  const mapHtml = useMemo(() => (path.length ? pathHtml({ points: path, name: item?.fdPrdtNm ?? "" }) : ""), [item]); // eslint-disable-line react-hooks/exhaustive-deps

  if (item === undefined) return <ActivityIndicator style={{ marginTop: 40 }} color={C.brand} />;
  if (item === null) return <Text style={st.missing}>이 습득물을 찾을 수 없어요.</Text>;

  const isUser = item.source === "user";
  const deadline = deadlineOf(item);
  const now = path.find((p) => p.kind === "now");
  const placeName = isUser ? item.currentPlace ?? item.depPlace : item.depPlace;
  const goUrl = now ? directionsUrl(placeName, now.lat, now.lng) : `https://map.kakao.com/link/search/${encodeURIComponent(placeName)}`;

  // 사용자 제보 물건의 버튼 → 서버에 기록하고 결과를 알려 준다
  async function report(kind: "here" | "gone" | "moved", extra?: { place?: string; lat?: number; lng?: number }) {
    if (IS_MOCK) return notify("예시 모드", "서버(EXPO_PUBLIC_API_URL)를 연결하면 실제로 기록돼요.");
    setSending(true);
    try {
      const r = await apiReportItem(item!.atcId, kind, extra);
      notify("알려 주셔서 고마워요", r.message);
      setPanel("");
      setMovePlace("");
      load(); // 상태·이동 기록·지도 새로 고침
    } catch (e) {
      notify("보내지 못했어요", (e as Error).message);
    } finally {
      setSending(false);
    }
  }

  /** 옮겼어요: 적은 장소 + (허락하면) 지금 휴대폰 위치 = 옮긴 곳 좌표 */
  async function reportMove(useHere: boolean) {
    const place = movePlace.trim();
    if (place.length < 2) return notify("옮긴 장소를 적어 주세요", "예: 학생회관 1층 경비실");
    let coords: { lat: number; lng: number } | undefined;
    if (useHere) {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.granted) {
          const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coords = { lat: p.coords.latitude, lng: p.coords.longitude };
        }
      } catch {
        /* 위치 없이도 기록 (서버가 장소 이름으로 찾아봄) */
      }
    }
    report("moved", { place, ...coords });
  }

  function startClaim() {
    if (IS_MOCK) return notify("예시 모드", "서버를 연결하면 AI가 확인해요.");
    if (!loggedIn) return ask("로그인이 필요해요", "로그인하면 '제 물건이에요'를 누를 수 있어요.", "로그인하러 가기", () => router.push("/my"));
    setClaim(null);
    setAnswer("");
    setPanel(panel === "claim" ? "" : "claim");
  }

  /** AI 본인 확인: 1차는 특징 설명, AI 가 질문하면 2차로 그 답 */
  async function submitClaim() {
    const a = answer.trim();
    if (a.length < (claim?.result === "question" ? 1 : 4)) return notify("조금 더 자세히 적어 주세요", "예: 안에 학생증이 있어요 / 뒷면에 곰돌이 스티커");
    setSending(true);
    try {
      const r = claim?.result === "question" && claim.ticket ? await apiClaim({ ticket: claim.ticket, answer2: a }) : await apiClaim({ id: item!.atcId, answer: a });
      setClaim(r);
      setAnswer("");
      if (r.result === "approved" || r.result === "pending") load();
    } catch (e) {
      notify("확인하지 못했어요", (e as Error).message);
    } finally {
      setSending(false);
    }
  }

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
        {!isUser && <Text style={st.hours}>🕘 {OFFICE_HOURS}</Text>}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
          {!isUser && item.tel ? (
            <Button title="📞 전화하기" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${item.tel}`)} />
          ) : null}
          <Button title="🧭 길찾기" kind="line" style={{ flex: 1 }} onPress={() => Linking.openURL(goUrl)} />
        </View>
        {!isUser && item.tel ? <Text style={st.hours}>{item.tel}</Text> : null}
      </View>

      {/* 보관 기한 (경찰서·기관 물건) */}
      {deadline && item.status === "보관중" && (
        <View style={[st.dday, deadline.left <= 7 && st.ddayHot, deadline.left < 0 && st.ddayOver]}>
          <Text style={[st.ddayBig, deadline.left <= 7 && { color: "#C62828" }]}>{ddayText(deadline.left)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.ddayTitle}>
              {deadline.left < 0 ? "보관 기한이 지났어요" : `보관 기한 ${deadline.date}까지 (약)`}
            </Text>
            <Text style={st.ddayText}>
              경찰서에 맡겨진 물건은 공고 후 6개월이 지나면 주인이 찾아갈 수 없어요. 습득일 기준으로 계산한 날짜라 실제 기한은 며칠 더 늦을 수 있어요.
            </Text>
          </View>
        </View>
      )}

      {/* 지도: 위치 / 이동 경로 */}
      {mapHtml ? (
        <View style={{ marginTop: 14 }}>
          <Text style={st.mapTitle}>{path.length > 1 ? "🗺️ 이동 경로" : "🗺️ 위치"}</Text>
          {path.length > 1 && (
            <Text style={st.hint}>
              {path.map((p, i) => `${i + 1}. ${p.kind === "found" ? "처음 발견" : p.kind === "now" ? "지금 여기" : "옮김"}`).join("  →  ")}
            </Text>
          )}
          <LeafletMap html={mapHtml} style={st.map} />
        </View>
      ) : null}

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

      {/* AI 확인 결과 */}
      {claim && claim.result !== "question" && (
        <View style={[st.result, claim.result === "approved" ? st.resultOk : claim.result === "rejected" ? st.resultNo : null]}>
          <Text style={st.resultTitle}>
            {claim.result === "approved" ? "✅ 주인으로 확인됐어요" : claim.result === "rejected" ? "확인하지 못했어요" : "운영자가 확인할게요"}
          </Text>
          <Text style={st.noteText}>{claim.message}</Text>
          {claim.result === "approved" && claim.lat != null && claim.lng != null && (
            <Button title="🧭 찾으러 가기 (길찾기)" style={{ marginTop: 10 }} onPress={() => Linking.openURL(directionsUrl(claim.place ?? placeName, claim.lat!, claim.lng!))} />
          )}
        </View>
      )}

      {isUser && (item.status === "확인 중" || item.status === "주인 찾음") && !claim && (
        <View style={st.note}>
          <Text style={st.noteText}>
            {item.status === "확인 중" ? "주인이라는 분이 나타나서 확인하고 있어요. 확인이 끝날 때까지 목록에서 잠시 숨겨져요." : "주인을 찾은 물건이에요. 🎉"}
          </Text>
        </View>
      )}
      {isUser && item.status !== "확인 중" && item.status !== "주인 찾음" && (
        <View style={{ gap: 8, marginTop: 18 }}>
          <Button title="🙋 제 물건이에요" disabled={sending} onPress={startClaim} />
          {panel === "claim" && (
            <View style={st.panel}>
              {claim?.result === "question" ? (
                <>
                  <Text style={st.panelTitle}>🤖 AI가 하나만 더 물어볼게요</Text>
                  <Text style={st.question}>{claim.question}</Text>
                </>
              ) : (
                <>
                  <Text style={st.panelTitle}>🤖 AI 본인 확인</Text>
                  <Text style={st.noteText}>
                    목록에 안 나온 <Text style={{ fontWeight: "800" }}>이 물건만의 특징</Text>을 적어 주세요. 주운 분이 남긴 확인 정보, 내가 먼저 등록한 잃어버린 물건과 비교해서 AI가 바로 판단해요.
                  </Text>
                  <Text style={st.example}>예: 안에 신구대 학생증이 있어요 / 뒷면 오른쪽 아래에 곰돌이 스티커 / 지퍼에 파란 키링</Text>
                </>
              )}
              <TextInput
                value={answer}
                onChangeText={setAnswer}
                multiline
                placeholder={claim?.result === "question" ? "답을 적어 주세요" : "이 물건만의 특징"}
                placeholderTextColor={C.faint}
                style={st.input}
                maxLength={300}
              />
              <Button title={sending ? "AI가 확인하는 중…" : claim?.result === "question" ? "답 보내기" : "AI에게 확인받기"} disabled={sending} onPress={submitClaim} />
              <Text style={st.small}>한 물건에 2번까지 요청할 수 있어요. 확인되면 다른 사람이 가져가지 않게 목록에서 숨겨요.</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="아직 여기 있어요" kind="line" style={{ flex: 1 }} disabled={sending} onPress={() => report("here")} />
            <Button title="현장에 없어요" kind="line" style={{ flex: 1 }} disabled={sending} onPress={() => report("gone")} />
          </View>
          <Button title="📦 다른 곳으로 옮겼어요" kind="line" disabled={sending} onPress={() => setPanel(panel === "move" ? "" : "move")} />
          {panel === "move" && (
            <View style={st.panel}>
              <Text style={st.panelTitle}>어디로 옮기셨어요?</Text>
              <TextInput value={movePlace} onChangeText={setMovePlace} placeholder="예: 학생회관 1층 경비실" placeholderTextColor={C.faint} style={[st.input, { minHeight: 48 }]} maxLength={60} />
              <Button title="📍 지금 내 위치로 기록 (옮긴 곳에 있을 때)" disabled={sending} onPress={() => reportMove(true)} />
              <Button title="장소 이름만 기록" kind="line" disabled={sending} onPress={() => reportMove(false)} />
            </View>
          )}
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
                  {!!s.note && <Text style={st.quote}>“{s.note}”</Text>}
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
  hours: { fontSize: F.xs, color: C.sub, marginTop: 6 },
  dday: { flexDirection: "row", gap: 14, alignItems: "center", marginTop: 14, padding: 16, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  ddayHot: { borderColor: "#E57373", backgroundColor: "#FFF5F5" },
  ddayOver: { opacity: 0.7 },
  ddayBig: { fontSize: F.xxl, fontWeight: "900", color: C.brandDark, minWidth: 74, textAlign: "center" },
  ddayTitle: { fontSize: F.md, fontWeight: "800", color: C.ink },
  ddayText: { fontSize: F.xs, color: C.sub, marginTop: 2, lineHeight: 18 },
  mapTitle: { fontSize: F.lg, fontWeight: "800", color: C.ink, marginBottom: 4 },
  map: { height: 280, borderRadius: 18, borderWidth: 1, borderColor: C.line, marginTop: 6 },
  panel: { gap: 10, padding: 16, borderRadius: 18, backgroundColor: C.brandSoft, borderWidth: 1, borderColor: "#C9D8FA" },
  panelTitle: { fontSize: F.md, fontWeight: "800", color: C.brandDark },
  question: { fontSize: F.lg, fontWeight: "700", color: C.ink, lineHeight: 26 },
  example: { fontSize: F.xs, color: C.sub, lineHeight: 18 },
  input: { minHeight: 80, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, fontSize: F.md, color: C.ink, textAlignVertical: "top" },
  small: { fontSize: F.xs, color: C.sub },
  result: { marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, gap: 6 },
  resultOk: { backgroundColor: C.okSoft, borderColor: "#9BD3B0" },
  resultNo: { backgroundColor: "#FFF5F5", borderColor: "#F2B8B8" },
  resultTitle: { fontSize: F.lg, fontWeight: "800", color: C.ink },
});

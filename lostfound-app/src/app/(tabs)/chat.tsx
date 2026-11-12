/**
 * 챗봇 탭: 챗봇 하나로 등록(주운 사람)과 찾기(잃어버린 사람)를 둘 다 한다.
 * 빠진 정보(사진·발견 장소·현재 위치)만 골라서 묻고, 사진은 카메라로 바로 찍는다.
 */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
  type TextInputInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ItemCard, Thumb } from "@/components/ui";
import { IS_MOCK, sendChat } from "@/lib/api";
import { refreshMe } from "@/lib/store";
import { C, F } from "@/lib/theme";
import type { Analysis, BotMessage, ChatRequest, ChatState, QuickReply } from "@/lib/types";

type Photo = NonNullable<ChatRequest["image"]>;
type Line = { who: "me"; text: string; image?: string } | { who: "bot"; msg: BotMessage };

const GREETING: Line = {
  who: "bot",
  msg: {
    type: "text",
    text: "안녕하세요! 물건을 **주우셨나요**, **잃어버리셨나요?**\n사진과 함께 편하게 적어 주세요.\n예: “오늘 길가다가 발견함”",
  },
};
const START_REPLIES: QuickReply[] = [
  { label: "🙋 주웠어요", value: "물건을 주웠어요" },
  { label: "🔎 잃어버렸어요", value: "물건을 잃어버렸어요" },
];

export default function ChatScreen() {
  const { start } = useLocalSearchParams<{ start?: string }>();
  const insets = useSafeAreaInsets();
  const [lines, setLines] = useState<Line[]>([GREETING]);
  const [state, setState] = useState<ChatState>({});
  const [lastMode, setLastMode] = useState<ChatState["mode"]>(); // 끝나면 서버가 mode 를 지워서, 완료 표시용으로 기억
  const [quick, setQuick] = useState<QuickReply[]>(START_REPLIES);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const inputRef = useRef<TextInputInstance>(null);

  // 목록 탭의 "주웠어요 / 잃어버렸어요" 버튼으로 들어오면 처음부터 바로 시작
  useEffect(() => {
    if (start !== "found" && start !== "lost") return;
    reset();
    send(start === "found" ? "물건을 주웠어요" : "물건을 잃어버렸어요", {}, { lines: [GREETING], state: {} });
    router.setParams({ start: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  function reset() {
    setLines([GREETING]);
    setState({});
    setLastMode(undefined);
    setQuick(START_REPLIES);
    setPhoto(null);
  }

  /** fresh: 처음부터 다시 시작할 때 아직 반영 안 된 상태 대신 쓰는 값 */
  async function send(message: string, extra: Partial<ChatRequest> = {}, fresh?: { lines: Line[]; state: ChatState }) {
    if (busy) return;
    if (message === "__reset__") return reset();
    const image = extra.image ?? photo ?? undefined;
    if (!message.trim() && !image) return;
    const base = fresh?.lines ?? lines;
    setLines([...base, { who: "me", text: message, image: image?.uri }]);
    setText("");
    setPhoto(null);
    setQuick([]);
    setBusy(true);
    try {
      const r = await sendChat({ state: fresh?.state ?? state, message, image, ...extra });
      setState(r.state);
      if (r.state.mode) setLastMode(r.state.mode);
      setLines((l) => [...l, ...r.messages.map((msg) => ({ who: "bot" as const, msg }))]);
      setQuick(r.quickReplies ?? []);
      if (r.state.step === "done") refreshMe(); // 등록·저장이 끝나면 마이페이지·알림 새로 고침
    } catch (e) {
      setLines((l) => [...l, { who: "bot", msg: { type: "text", text: (e as Error).message } }]);
    } finally {
      setBusy(false);
    }
  }

  /** 카메라로 찍거나 앨범에서 고르기 */
  function pickPhoto() {
    const take = async (camera: boolean) => {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert(camera ? "카메라 권한이 필요해요" : "사진 접근 권한이 필요해요", "설정에서 권한을 켜 주세요.");
      const opts: ImagePicker.ImagePickerOptions = { quality: 1, mediaTypes: ["images"] };
      const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (r.canceled) return;
      const a = r.assets[0];
      // 긴 변 1280px · JPEG 70% 로 줄여서 보낸다 (업로드 빠르게, S3·Bedrock 비용 절약, 분석에는 충분)
      const ctx = ImageManipulator.manipulate(a.uri);
      if (Math.max(a.width, a.height) > 1280) ctx.resize(a.width >= a.height ? { width: 1280 } : { height: 1280 });
      const small = await (await ctx.renderAsync()).saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
      setPhoto({ name: "photo.jpg", uri: small.uri, base64: small.base64 ?? undefined });
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["📷 사진 찍기", "🖼️ 앨범에서 고르기", "취소"], cancelButtonIndex: 2 },
        (i) => (i === 0 ? take(true) : i === 1 ? take(false) : undefined),
      );
    } else if (Platform.OS === "web") {
      take(false);
    } else {
      Alert.alert("사진 올리기", undefined, [
        { text: "📷 사진 찍기", onPress: () => take(true) },
        { text: "🖼️ 앨범에서 고르기", onPress: () => take(false) },
        { text: "취소", style: "cancel" },
      ]);
    }
  }

  async function onQuick(q: QuickReply) {
    if (q.action === "pick_photo") return pickPhoto();
    if (q.action === "go_mypage") return router.push("/my");
    if (q.action === "open_items") return router.push({ pathname: "/items", params: { ...(q.params ?? {}), t: String(Date.now()) } });
    if (q.action === "use_location") {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return send(q.value); // 거절해도 대화는 이어진다 (서버가 다시 물어봄)
      setBusy(true);
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const address = await addressOf(loc.coords.latitude, loc.coords.longitude);
        setBusy(false);
        // 말풍선에도 실제 주소를 보여 준다 ("지금 위치예요 (경기도 성남시 중원구 광명로 377)")
        return send(address ? `${q.value} (${address})` : q.value, { location: { lat: loc.coords.latitude, lng: loc.coords.longitude, address } });
      } catch {
        setBusy(false);
        return send(q.value);
      }
    }
    if (!q.value) {
      setQuick([]);
      return inputRef.current?.focus();
    }
    send(q.value);
  }

  const lastPickable = lines.reduce((at, ln, i) => (ln.who === "bot" && ln.msg.type === "results" && ln.msg.pickable ? i : at), -1);

  // 머리글(위)과 탭바(아래) 높이를 빼고 키보드만큼 올린다
  const kbOffset = insets.top + 44 - (49 + insets.bottom);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={kbOffset}>
      {IS_MOCK && <Text style={st.mock}>예시 응답이에요 (AI 연결 전)</Text>}
      <StepBar state={state} lastMode={lastMode} busy={busy} onCancel={() => { setPhoto(null); send("취소"); }} />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {lines.map((ln, i) =>
          ln.who === "me" ? (
            <MyLine key={i} text={ln.text} image={ln.image} />
          ) : (
            <BotLine
              key={i}
              msg={ln.msg}
              // [이거예요] 는 지금 고르는 중인 마지막 결과에만
              onPick={state.step === "ask_pick" && i === lastPickable && !busy ? (id) => send("이거예요", { pickId: id }) : undefined}
            />
          ),
        )}
        {busy && (
          <View style={st.botRow}>
            <Avatar />
            <View style={[st.bubbleBot, { paddingVertical: 14 }]}>
              <ActivityIndicator color={C.sub} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* 빠른 답 */}
      {quick.length > 0 && !busy && (
        <View style={st.quickWrap}>
          {quick.map((q) => (
            <Pressable key={q.label} onPress={() => onQuick(q)} style={({ pressed }) => [st.quick, pressed && { backgroundColor: C.brandSoft }]}>
              <Text style={st.quickText}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* 입력창 */}
      <View style={st.inputBox}>
        {photo && (
          <View style={st.preview}>
            <Image source={{ uri: photo.uri }} style={{ width: 56, height: 56, borderRadius: 10 }} />
            <Text style={{ flex: 1, color: C.ink2, fontSize: F.sm }} numberOfLines={1}>사진 1장 보낼 준비됨</Text>
            <Pressable onPress={() => setPhoto(null)} hitSlop={10}>
              <Text style={{ color: C.sub, fontWeight: "700", fontSize: F.sm }}>빼기</Text>
            </Pressable>
          </View>
        )}
        <View style={st.inputRow}>
          <Pressable onPress={pickPhoto} style={st.camBtn} accessibilityLabel="사진 올리기" accessibilityRole="button">
            <Text style={{ fontSize: 24 }}>📷</Text>
          </Pressable>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="예: 정문에서 지갑 주움"
            placeholderTextColor={C.faint}
            multiline
            style={st.input}
            accessibilityLabel="메시지"
          />
          <Pressable
            onPress={() => send(text)}
            disabled={busy || (!text.trim() && !photo)}
            style={[st.sendBtn, (busy || (!text.trim() && !photo)) && { opacity: 0.4 }]}
            accessibilityRole="button"
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: F.md }}>보내기</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * 좌표 → 실제 주소 (휴대폰 OS 의 주소 변환 사용, 무료)
 *   Android 는 formattedAddress 가 오고, iOS 는 시/구/도로명을 이어 붙인다. 실패하면 "" (서버는 좌표만 씀)
 */
async function addressOf(lat: number, lng: number): Promise<string> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!a) return "";
    const formatted = a.formattedAddress?.replace(/^대한민국\s*/, "").trim();
    if (formatted) return formatted.slice(0, 60);
    const parts = [a.region, a.city, a.subregion, a.district, a.street, a.streetNumber].filter((p): p is string => !!p);
    return [...new Set(parts)].join(" ").slice(0, 60);
  } catch {
    return "";
  }
}

/** 등록·찾기가 몇 단계 중 어디인지 (예: 습득물 등록 2/3 · 발견한 곳) */
const STEPS: Record<string, { title: string; steps: { key: string[]; label: string }[] }> = {
  register: {
    title: "습득물 등록",
    steps: [
      { key: ["ask_photo"], label: "사진 보내기" },
      { key: ["ask_confirm"], label: "물건 확인" },
      { key: ["ask_found_place"], label: "발견한 곳" },
      { key: ["ask_current_place", "ask_same"], label: "지금 위치" },
    ],
  },
  find: {
    title: "분실물 찾기",
    steps: [
      { key: ["ask_features", "ask_confirm"], label: "물건 설명" },
      { key: ["ask_pick", "picked"], label: "비슷한 물건 보기" },
      { key: ["ask_lost_place", "ask_review", "ask_more", "ask_save"], label: "등록하고 알림 받기" },
    ],
  },
};

function StepBar({ state, lastMode, busy, onCancel }: { state: ChatState; lastMode?: ChatState["mode"]; busy: boolean; onCancel: () => void }) {
  const mode = state.mode ?? (state.step === "done" ? lastMode : undefined);
  const flow = mode ? STEPS[mode] : undefined;
  if (!flow || !state.step || state.step === "ask_mode") return null;
  const done = state.step === "done";
  const idx = flow.steps.findIndex((s) => s.key.includes(state.step!));
  const now = done ? flow.steps.length : idx + 1;
  if (now <= 0) return null;
  const label = done ? "완료" : flow.steps[now - 1].label;
  return (
    <View style={st.stepBox} accessibilityRole="progressbar" accessibilityLabel={`${flow.title} ${now}/${flow.steps.length} 단계, ${label}`}>
      <View style={st.stepHead}>
        <Text style={st.stepTitle}>{flow.title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={st.stepNow}>
            <Text style={{ color: C.brand }}>{now}</Text>/{flow.steps.length} · {label}
          </Text>
          {!done && (
            <Pressable onPress={onCancel} disabled={busy} style={[st.cancel, busy && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel={`${flow.title} 취소`} hitSlop={8}>
              <Text style={st.cancelText}>취소</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View style={st.stepBars}>
        {flow.steps.map((s, i) => (
          <View key={s.label} style={[st.stepSeg, i < now && { backgroundColor: done ? C.ok : C.brand }]} />
        ))}
      </View>
    </View>
  );
}

function MyLine({ text, image }: { text: string; image?: string }) {
  return (
    <View style={{ alignItems: "flex-end", gap: 6 }}>
      {image && <Image source={{ uri: image }} style={{ width: 200, height: 200, borderRadius: 18 }} />}
      {!!text && (
        <View style={st.bubbleMe}>
          <Text style={{ color: "#fff", fontSize: F.md, lineHeight: 24 }}>{text}</Text>
        </View>
      )}
    </View>
  );
}

function BotLine({ msg, onPick }: { msg: BotMessage; onPick?: (id: string) => void }) {
  return (
    <View style={st.botRow}>
      <Avatar />
      <View style={{ flex: 1, gap: 8 }}>
        {msg.type === "text" && (
          <View style={st.bubbleBot}>
            <Rich text={msg.text} />
          </View>
        )}
        {msg.type === "analysis" && <AnalysisCard a={msg.analysis} />}
        {msg.type === "candidate" && (
          <View style={{ gap: 6 }}>
            <Text style={st.small}>이미 등록된 비슷한 물건</Text>
            <ItemCard item={msg.item} />
          </View>
        )}
        {msg.type === "registered" && (
          <View style={[st.card, { borderColor: C.ok }]}>
            <Text style={{ color: C.ok, fontWeight: "800", fontSize: F.md, marginBottom: 10 }}>✓ 등록 완료</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Thumb item={msg.item} size={64} />
              <View style={{ flex: 1, gap: 4 }}>
                <KV k="물건" v={msg.item.fdSbjt} bold />
                <KV k="발견한 곳" v={msg.item.foundPlace} />
                <KV k="현재 위치" v={msg.item.currentPlace} color={C.brandDark} bold />
              </View>
            </View>
          </View>
        )}
        {msg.type === "lost_saved" && (
          <View style={[st.card, { borderColor: C.brand, backgroundColor: C.brandSoft }]}>
            <Text style={{ color: C.brandDark, fontWeight: "800", fontSize: F.md, marginBottom: 8 }}>📌 잃어버린 물건으로 등록했어요</Text>
            <View style={{ gap: 4 }}>
              <KV k="물건" v={`${msg.lost.color} ${msg.lost.kind}`} bold />
              <KV k="장소" v={msg.lost.place} />
              {msg.lost.features.length > 0 && <KV k="특징" v={msg.lost.features.join(", ")} />}
            </View>
            <Text style={{ color: C.ink2, fontSize: F.sm, marginTop: 10, lineHeight: 21 }}>
              비슷한 물건이 새로 등록되면 🔔 알림을 보내 드려요. 마이페이지에서 언제든 확인할 수 있어요.
            </Text>
          </View>
        )}
        {msg.type === "results" && (
          <View style={{ gap: 8 }}>
            <View style={st.bubbleBot}>
              <Text style={{ fontSize: F.md, fontWeight: "700", color: C.ink }}>{msg.title}</Text>
            </View>
            {msg.items.map((it) => (
              <View key={`${it.atcId}-${it.fdSn}`} style={{ gap: 6 }}>
                <ItemCard item={it} />
                {onPick && (
                  <Pressable onPress={() => onPick(it.atcId)} style={({ pressed }) => [st.pickBtn, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`${it.fdPrdtNm}, 내 물건이에요`}>
                    <Text style={st.pickText}>🙋 이거예요</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
        {msg.type === "pickup" && (
          <View style={[st.card, { borderColor: C.ok, backgroundColor: C.okSoft, gap: 10 }]}>
            <Text style={{ color: C.ok, fontWeight: "800", fontSize: F.md }}>🎉 찾으러 가는 방법</Text>
            <ItemCard item={msg.item} />
            <Rich text={msg.how} />
            {!!msg.tel && (
              <Pressable onPress={() => Linking.openURL(`tel:${msg.tel}`)} style={({ pressed }) => [st.callBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
                <Text style={st.callText}>📞 전화하기 {msg.tel}</Text>
              </Pressable>
            )}
            <Text style={st.small}>카드를 누르면 자세한 정보를 볼 수 있어요.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** AI 가 사진에서 뽑은 정보 */
function AnalysisCard({ a }: { a: Analysis }) {
  return (
    <View style={st.card}>
      <Text style={{ fontSize: F.md, fontWeight: "800", color: C.ink, marginBottom: 10 }}>🤖 사진을 보고 정리했어요</Text>
      <View style={{ gap: 6 }}>
        <KV k="종류" v={`${a.kind} (${a.category})`} bold />
        <KV k="색상" v={a.color} />
        <KV k="특징" v={a.features.join(", ")} />
      </View>
      {!a.distinctive && (
        <Text style={st.warn}>비슷하게 생긴 물건이 많은 종류예요. 스티커나 흠집이 있으면 알려 주세요.</Text>
      )}
    </View>
  );
}

function KV({ k, v, bold, color }: { k: string; v?: string; bold?: boolean; color?: string }) {
  if (!v) return null;
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Text style={{ width: 78, color: C.sub, fontSize: F.sm, fontWeight: "600", paddingTop: 1 }}>{k}</Text>
      <Text style={{ flex: 1, color: color ?? C.ink, fontSize: F.md, fontWeight: bold ? "700" : "400", lineHeight: 23 }}>{v}</Text>
    </View>
  );
}

/** **굵게** 와 줄바꿈만 지원 */
function Rich({ text }: { text: string }) {
  return (
    <Text style={{ fontSize: F.md, color: C.ink, lineHeight: 25 }}>
      {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith("**") ? (
          <Text key={i} style={{ fontWeight: "800" }}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

function Avatar() {
  return (
    <View style={st.avatar}>
      <Text style={{ color: "#fff", fontWeight: "800" }}>?</Text>
    </View>
  );
}

const st = StyleSheet.create({
  pickBtn: { alignSelf: "flex-end", paddingHorizontal: 16, minHeight: 42, borderRadius: 999, backgroundColor: C.brand, justifyContent: "center" },
  pickText: { color: "#fff", fontWeight: "800", fontSize: F.sm },
  callBtn: { minHeight: 50, borderRadius: 14, backgroundColor: C.ok, alignItems: "center", justifyContent: "center" },
  callText: { color: "#fff", fontWeight: "800", fontSize: F.md },
  stepBox: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  stepHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  stepTitle: { fontSize: F.sm, fontWeight: "700", color: C.sub },
  stepNow: { fontSize: F.md, fontWeight: "800", color: C.ink },
  cancel: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg },
  cancelText: { fontSize: F.sm, fontWeight: "700", color: C.ink2 },
  stepBars: { flexDirection: "row", gap: 6, marginTop: 8 },
  stepSeg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.line },
  mock: { textAlign: "center", fontSize: F.xs, color: C.sub, paddingVertical: 6, backgroundColor: C.line },
  botRow: { flexDirection: "row", gap: 8, alignItems: "flex-start", paddingRight: 24 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  bubbleBot: {
    alignSelf: "flex-start",
    backgroundColor: C.card,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: C.line,
  },
  bubbleMe: { maxWidth: "85%", backgroundColor: C.brand, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 15, paddingVertical: 11 },
  card: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16 },
  small: { fontSize: F.sm, color: C.sub, fontWeight: "600" },
  warn: { marginTop: 12, backgroundColor: C.reportSoft, color: C.report, fontSize: F.sm, padding: 10, borderRadius: 10, overflow: "hidden", lineHeight: 21 },
  quickWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  quick: { minHeight: 42, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: C.brand, backgroundColor: C.card, justifyContent: "center" },
  quickText: { color: C.brandDark, fontWeight: "700", fontSize: F.sm },
  inputBox: { margin: 12, marginTop: 0, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, padding: 8 },
  preview: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.bg, borderRadius: 12, padding: 6, marginBottom: 8 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  camBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  input: { flex: 1, minHeight: 48, maxHeight: 120, fontSize: F.md, color: C.ink, paddingHorizontal: 6, paddingTop: 13, paddingBottom: 13 },
  sendBtn: { height: 48, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
});

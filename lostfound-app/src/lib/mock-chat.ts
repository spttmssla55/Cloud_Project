/**
 * 챗봇 목업 — 실제로는 Lambda(Bedrock)가 하는 일을 화면 확인용으로 흉내 낸다.
 * 규칙: 등록/찾기를 판단하고, 빠진 정보(사진·위치)만 골라서 묻는다.
 * Lambda 를 연결하면 이 파일은 쓰지 않는다 — 요청/응답 모양(ChatRequest/ChatReply)만 맞추면 된다.
 */
import { localYmd } from "./format";
import { MOCK_ITEMS } from "./mock-data";
import type { Analysis, ChatReply, ChatRequest, ChatState, FoundItem } from "./types";

const FOUND_WORDS = /(발견|주웠|주움|봤|봄|있길래|떨어져|습득|맡겼|올려둘|두고 갑)/;
const LOST_WORDS = /(잃어버|잃어 버|분실|없어졌|찾아|찾고|어디 갔|놓고 왔|두고 왔)/;
const HERE_WORDS = /(여기|지금 위치|현재 위치|이 근처)/;

/** 글에서 "○○에서" 앞부분을 장소로 뽑는다 (실제로는 AI 가 함) */
function placeFrom(text: string): string | undefined {
  const m = text.match(/([가-힣A-Za-z0-9\s]{2,30}?)(?:에서|앞에서|근처에서)/);
  const place = m?.[1].replace(/^(오늘|어제|아까|방금|길가다가|길 가다가)\s*/, "").trim();
  return place && place.length >= 2 ? place : undefined;
}

/** 글에서 "지금 물건이 있는 곳"을 뽑는다 */
function currentFrom(text: string, found?: string): string | undefined {
  if (/옆에\s*(올려|두|놓)/.test(text) && found) return `${found} 바로 옆`;
  const m = text.match(/([가-힣A-Za-z0-9\s]{2,20}?)(?:에|에다)\s*(맡겼|맡김|두었|뒀|놓았|놨|가져다)/);
  if (m) return m[1].trim();
  if (/그대로/.test(text) && found) return found;
  return undefined;
}

/** 사진·글로 물건 종류를 추정 (실제로는 Bedrock 이 사진을 보고 판단) */
function analyze(text: string, imageName = ""): Analysis {
  const s = `${text} ${imageName}`.toLowerCase();
  const rules: [RegExp, Omit<Analysis, "features" | "distinctive">][] = [
    [/(에어팟|이어폰|버즈|airpod)/, { kind: "무선이어폰", category: "전자기기", color: "흰색" }],
    [/(폰|휴대폰|핸드폰|아이폰|갤럭시|phone)/, { kind: "스마트폰", category: "휴대폰", color: "검정" }],
    [/(우산|umbrella)/, { kind: "장우산", category: "우산", color: "남색" }],
    [/(카드|학생증|신분증|card)/, { kind: "카드", category: "카드", color: "흰색" }],
    [/(가방|백팩|bag)/, { kind: "백팩", category: "가방", color: "검정" }],
    [/(여권|passport)/, { kind: "여권", category: "증명서", color: "남색" }],
  ];
  const hit = rules.find(([re]) => re.test(s))?.[1] ?? { kind: "반지갑", category: "지갑", color: "검정" };
  const features: string[] = [];
  if (/스티커/.test(s)) features.push("스티커");
  if (/(흠집|긁힘|스크래치)/.test(s)) features.push("긁힌 자국");
  if (/키링/.test(s)) features.push("키링");
  if (!features.length) features.push(hit.category === "지갑" ? "가죽 재질" : "특별한 표시 없음");
  return { ...hit, features, distinctive: features.some((f) => f !== "특별한 표시 없음" && f !== "가죽 재질") };
}

/** 같은 물건 후보 찾기 (실제로는 이미지 임베딩 + 장소·시간 비교) */
function findCandidate(a: Analysis, place?: string): FoundItem | undefined {
  return MOCK_ITEMS.find(
    (it) => it.source === "user" && it.prdtClNm.startsWith(a.category) && (!place || (it.foundPlace ?? "").includes(place.split(" ")[0])),
  );
}

/** 종류가 같은 것만, 특징이 겹치는 것을 앞으로 (실제로는 이미지 임베딩 + 위치 거리로 순위) */
function search(a: Analysis, text: string): FoundItem[] {
  const words = text.split(/\s+/).filter((w) => w.length >= 2);
  const score = (it: FoundItem) =>
    words.filter((w) => [it.fdSbjt, it.clrNm, ...(it.features ?? [])].some((v) => v?.includes(w))).length;
  return MOCK_ITEMS.filter((it) => it.prdtClNm.startsWith(a.category))
    .sort((x, y) => score(y) - score(x))
    .slice(0, 5);
}

/** "신구대 근처" → "신구대" (화면 문장에서 '근처 근처'가 되지 않게) */
const trimNear = (p: string) => p.replace(/\s*(근처|주변|쯤|어딘가)(예요|이요|요)?$/, "").trim() || p;

const newItem = (st: ChatState): FoundItem => ({
  source: "user",
  atcId: `U${Date.now()}`,
  fdSn: "1",
  fdPrdtNm: st.analysis!.kind,
  prdtClNm: `${st.analysis!.category} > ${st.analysis!.kind}`,
  clrNm: st.analysis!.color,
  fdSbjt: `${st.analysis!.color} ${st.analysis!.kind}`,
  depPlace: st.currentPlace!,
  fdYmd: localYmd(),
  status: "현장에 있음",
  foundPlace: st.foundPlace,
  currentPlace: st.currentPlace,
  features: st.analysis!.features,
});

const HERE = "지금 계신 곳";

export async function mockChat(req: ChatRequest): Promise<ChatReply> {
  await new Promise((r) => setTimeout(r, 600)); // AI 가 생각하는 시간처럼
  const st: ChatState = { ...req.state };
  const text = req.message.trim();
  const place = req.location ? HERE : undefined;

  // 0. 등록인지 찾기인지
  if (!st.mode) {
    if (FOUND_WORDS.test(text) || (req.image && !LOST_WORDS.test(text))) st.mode = "register";
    else if (LOST_WORDS.test(text)) st.mode = "find";
    else
      return {
        state: { ...st, step: "ask_mode" },
        messages: [{ type: "text", text: "물건을 **주우셨나요**, 아니면 **잃어버리셨나요?**" }],
        quickReplies: [
          { label: "주웠어요", value: "물건을 주웠어요" },
          { label: "잃어버렸어요", value: "물건을 잃어버렸어요" },
        ],
      };
  }

  /* ───── 등록 (주운 사람) ───── */
  if (st.mode === "register") {
    if (req.image) st.imageName = req.image.name;
    const messages: ChatReply["messages"] = [];

    if (!st.imageName) {
      return {
        state: { ...st, step: "ask_photo", features: [st.features, text].filter(Boolean).join(" ") },
        messages: [{ type: "text", text: "고마워요! 물건 **사진**을 한 장 올려 주세요. 사진을 보고 어떤 물건인지 정리해 드릴게요." }],
        quickReplies: [{ label: "📷 사진 올리기", value: "", action: "pick_photo" }],
      };
    }
    if (!st.analysis) {
      st.analysis = analyze(`${st.features ?? ""} ${text}`, st.imageName);
      messages.push({ type: "analysis", analysis: st.analysis });
    }

    if (!st.foundPlace) {
      const p = place ?? (HERE_WORDS.test(text) ? HERE : placeFrom(text) ?? (st.step === "ask_found_place" && text ? text : undefined));
      if (!p) {
        messages.push({ type: "text", text: "어디서 발견하셨어요? **지금 계신 위치**인가요?" });
        return {
          state: { ...st, step: "ask_found_place" },
          messages,
          quickReplies: [
            { label: "📍 네, 지금 위치예요", value: "지금 위치예요", action: "use_location" },
            { label: "아니요, 직접 적을게요", value: "" },
          ],
        };
      }
      st.foundPlace = p;
    }

    if (!st.currentPlace) {
      const c = currentFrom(text, st.foundPlace) ?? (st.step === "ask_current_place" && text ? (/(그대로|두고)/.test(text) ? st.foundPlace : text) : undefined);
      if (!c) {
        messages.push({ type: "text", text: `발견한 곳은 **${st.foundPlace}**(으)로 적어 둘게요.\n지금 물건은 어디 있나요?` });
        return {
          state: { ...st, step: "ask_current_place" },
          messages,
          quickReplies: [
            { label: "발견한 곳에 그대로 뒀어요", value: "그대로 뒀어요" },
            { label: "다른 곳에 맡겼어요", value: "" },
          ],
        };
      }
      st.currentPlace = c;
    }

    // 같은 물건 확인 — 애매하면 둘 다 등록
    if (st.step !== "ask_same") {
      const cand = findCandidate(st.analysis!, st.foundPlace);
      if (cand) {
        messages.push({ type: "text", text: "근처에 **비슷한 물건 제보**가 이미 있어요. 같은 물건인가요?" });
        messages.push({ type: "candidate", item: cand });
        if (!st.analysis!.distinctive)
          messages.push({ type: "text", text: "주변에 **이것 말고 비슷한 물건이 또 있는지**도 한 번 봐 주세요." });
        return {
          state: { ...st, step: "ask_same", candidateId: cand.atcId },
          messages,
          quickReplies: [
            { label: "같은 물건이에요", value: "같은 물건이에요" },
            { label: "다른 물건이에요", value: "다른 물건이에요" },
            { label: "잘 모르겠어요", value: "잘 모르겠어요" },
          ],
        };
      }
    }

    const same = st.step === "ask_same" && /^같은/.test(text);
    const item = newItem(st);
    if (same) {
      messages.push({ type: "text", text: "같은 물건으로 확인했어요. **현재 위치만 새로 바꾸고**, 예전 위치는 이동 기록으로 남겨 둘게요." });
    } else if (st.step === "ask_same") {
      messages.push({ type: "text", text: "확실하지 않아서 **따로 등록**했어요. 주인이 두 제보를 모두 볼 수 있어요." });
    }
    messages.push({ type: "registered", item });
    messages.push({ type: "text", text: "등록했어요! 비슷한 물건을 찾는 분이 있으면 바로 연결돼요. 🙌" });
    return { state: { mode: undefined, step: "done" }, messages, quickReplies: [{ label: "처음으로", value: "__reset__" }] };
  }

  /* ───── 찾기 (잃어버린 사람) ───── */
  const messages: ChatReply["messages"] = [];
  if (req.image) st.imageName = req.image.name;

  if (!st.analysis) {
    const given = `${text} ${st.imageName ?? ""}`;
    const knows = /(지갑|에어팟|이어폰|폰|우산|카드|학생증|가방|백팩|여권)/.test(given) || st.imageName;
    if (!knows) {
      return {
        state: { ...st, step: "ask_features" },
        messages: [{ type: "text", text: "어떤 물건인가요? **사진**이 있으면 올려 주시고, 없으면 **색깔이나 특징**을 적어 주세요.\n예: 흰색 에어팟, 케이스에 곰돌이 스티커" }],
        quickReplies: [{ label: "📷 사진 올리기", value: "", action: "pick_photo" }],
      };
    }
    st.analysis = analyze(given, st.imageName);
    st.features = given;
  }

  if (!st.lostPlace) {
    const p = place ?? (HERE_WORDS.test(text) ? HERE : placeFrom(text) ?? (st.step === "ask_lost_place" && text ? text : undefined));
    if (!p) {
      messages.push({ type: "text", text: `**${st.analysis.color} ${st.analysis.kind}**(으)로 찾아볼게요.\n어디쯤에서 잃어버리셨어요?` });
      return {
        state: { ...st, step: "ask_lost_place" },
        messages,
        quickReplies: [
          { label: "📍 지금 위치 근처", value: "지금 위치 근처예요", action: "use_location" },
          { label: "직접 적을게요", value: "" },
        ],
      };
    }
    st.lostPlace = trimNear(p);
  }

  const found = search(st.analysis, st.features ?? "");
  if (found.length) {
    messages.push({ type: "results", title: `${st.lostPlace} 주변에서 비슷한 물건 ${found.length}건을 찾았어요`, items: found });
    messages.push({ type: "text", text: "맞는 물건이 없으면 **알림**을 켜 두세요. 비슷한 물건이 새로 등록되면 바로 알려 드릴게요." });
  } else {
    messages.push({ type: "text", text: "아직 비슷한 물건이 없어요. **알림**을 켜 두면 새로 등록될 때 바로 알려 드릴게요." });
  }
  return {
    state: { mode: undefined, step: "done" },
    messages,
    quickReplies: [
      { label: "🔔 알림 받기", value: "알림 받을게요" },
      { label: "처음으로", value: "__reset__" },
    ],
  };
}

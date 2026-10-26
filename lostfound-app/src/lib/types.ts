/**
 * 화면에서 쓰는 데이터 모양.
 * 공공 API 필드 이름(atcId, fdPrdtNm …)은 활용가이드 그대로 두고,
 * 사용자 제보에만 있는 값(발견 장소·현재 위치·이동 기록)을 더했다.
 */

/** 어디서 온 습득물인지 */
export type Source = "portal" | "police" | "user";
// portal: 경찰청_포털기관 습득물 (지하철·공항·쇼핑몰·놀이공원)
// police: 경찰청_습득물 (승인 후 추가)
// user:   우리 서비스 사용자 제보

/** 보관 상태 */
export type Status = "보관중" | "현장에 있음" | "현장에 없음" | "주인 찾음";

/** 목록 한 줄 (getPtLosfundInfoAccToClAreaPd 응답 + 출처) */
export interface FoundItem {
  source: Source;
  atcId: string; // 관리ID
  fdSn: string; // 습득순번
  fdPrdtNm: string; // 물품명
  prdtClNm: string; // 물품분류명 (예: "지갑 > 남성용 지갑")
  clrNm?: string; // 색상명
  fdSbjt: string; // 게시제목
  fdFilePathImg?: string; // 사진 URL (없으면 기본 그림)
  depPlace: string; // 보관장소
  fdYmd: string; // 습득일자 YYYY-MM-DD
  status: Status;
  /** 사용자 제보: AI 가 글에서 나눈 두 위치 */
  foundPlace?: string; // 발견한 곳
  currentPlace?: string; // 지금 물건이 있는 곳
  features?: string[]; // AI 가 사진에서 뽑은 특징 (스티커·흠집 등)
}

/** 상세 (getPtLosfundDetailInfo 응답) + 사용자 제보 이동 기록 */
export interface FoundItemDetail extends FoundItem {
  fdHor?: string; // 습득시간
  fdPlace?: string; // 습득장소
  fndKeepOrgnSeNm?: string; // 보관기관 구분 (놀이동산, 관서보관 …)
  orgNm?: string; // 기관명
  tel?: string; // 기관 전화번호
  uniq?: string; // 특이사항
  sightings?: Sighting[]; // 사용자 제보: 목격·이동 기록 (오래된 순)
}

/** 사용자 제보 한 건 (같은 물건이면 한 분실물 아래에 쌓임) */
export interface Sighting {
  at: string; // ISO 시각
  foundPlace: string;
  currentPlace: string;
  note: string; // 제보자가 적은 원문
}

export interface ListQuery {
  keyword?: string;
  category?: string; // 대분류 이름 (지갑, 전자기기 …)
  source?: Source | "all";
  days?: number; // 최근 n일
}

/* ───────── 챗봇 ───────── */

export type Mode = "register" | "find";

/** 챗봇이 대화 중에 기억하는 값. 서버(Lambda)가 돌려주고 화면은 다음 요청에 그대로 보낸다 */
export interface ChatState {
  mode?: Mode;
  step?: "ask_mode" | "ask_photo" | "ask_found_place" | "ask_current_place" | "ask_same" | "ask_features" | "ask_lost_place" | "done";
  imageName?: string;
  analysis?: Analysis;
  foundPlace?: string;
  currentPlace?: string;
  lostPlace?: string;
  features?: string;
  candidateId?: string; // 같은 물건 후보
}

/** AI 가 사진·글에서 뽑은 정보 */
export interface Analysis {
  kind: string; // 지갑, 무선이어폰 …
  category: string; // 대분류
  color: string;
  features: string[];
  distinctive: boolean; // 고유한 흔적(스티커·각인 등)이 있는지 → 같은 물건 판단에 씀
}

export interface ChatRequest {
  state: ChatState;
  message: string;
  /** 앱: uri 는 휴대폰 안의 사진 위치, base64 는 서버(Lambda → Bedrock)로 보낼 사진 데이터 */
  image?: { name: string; uri: string; base64?: string };
  location?: { lat: number; lng: number }; // "현재 위치예요" 를 누르면
}

export interface QuickReply {
  label: string;
  value: string; // 보낼 메시지
  action?: "use_location" | "pick_photo" | "go_mypage";
}

/* ───────── 사용자 · 잃어버린 물건 · 알림 ───────── */

export interface User {
  id: string;
  name: string;
  email: string;
}

/** 챗봇에서 "잃어버렸어요"로 물어보면 저장되는 것 (DB: REQ#<사용자id>) */
export interface LostItem {
  id: string;
  kind: string; // 무선이어폰 …
  category: string; // 대분류
  color: string;
  features: string[];
  place: string; // 잃어버린 곳
  createdAt: string; // ISO
  status: "찾는 중" | "찾음";
  matchIds: string[]; // 비슷하다고 알려 준 습득물 atcId
}

/** 비슷한 습득물이 새로 등록됐을 때 가는 알림 */
export interface Notice {
  id: string;
  at: string; // ISO
  lostId: string;
  itemId: string; // 습득물 atcId
  text: string;
  read: boolean;
}

export interface Stats {
  total: number; // 지금 보관 중인 습득물 수
  today: number; // 오늘 새로 들어온 습득물 수
}

export interface ChatReply {
  state: ChatState;
  messages: BotMessage[];
  quickReplies?: QuickReply[];
}

export type BotMessage =
  | { type: "text"; text: string }
  | { type: "analysis"; analysis: Analysis }
  | { type: "registered"; item: FoundItem }
  | { type: "results"; items: FoundItem[]; title: string }
  | { type: "lost_saved"; lost: LostItem }
  | { type: "candidate"; item: FoundItem };

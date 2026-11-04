/**
 * 기간 직접 고르기: 달력에서 시작일 → 끝일 두 번 누르기
 *   - 하루만 보려면 같은 날을 두 번 누르거나, 한 번 누르고 '적용'
 *   - 앞날보다 이른 날을 누르면 거기서 다시 시작
 *   - 오늘 이후 날짜는 고를 수 없음 (습득일은 미래가 없으니까)
 */
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { localYmd } from "@/lib/format";
import { C, F } from "@/lib/theme";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export type Range = { from: string; to: string }; // YYYY-MM-DD

export function DateRangePicker({
  visible,
  value,
  onClose,
  onApply,
}: {
  visible: boolean;
  value?: Range;
  onClose: () => void;
  onApply: (r: Range) => void;
}) {
  const today = localYmd();
  const [from, setFrom] = useState<string | undefined>(value?.from);
  const [to, setTo] = useState<string | undefined>(value?.to);
  const [month, setMonth] = useState(() => firstOfMonth(value?.to ?? today));

  // 열 때마다 지금 고른 값으로 맞춘다
  useEffect(() => {
    if (!visible) return;
    setFrom(value?.from);
    setTo(value?.to);
    setMonth(firstOfMonth(value?.to ?? today));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = useMemo(() => monthGrid(month), [month]);
  const [y, m] = month.split("-").map(Number);
  const canNext = month < firstOfMonth(today);

  function tap(d: string) {
    if (d > today) return;
    if (!from || to || d < from) {
      setFrom(d);
      setTo(undefined);
    } else {
      setTo(d);
    }
  }

  const label = !from ? "시작일을 누르세요" : !to ? `${pretty(from)} ~ 끝나는 날을 누르세요` : `${pretty(from)} ~ ${pretty(to)}`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="닫기">
        <Pressable style={st.sheet} onPress={() => {}}>
          <Text style={st.title}>습득일 기간 고르기</Text>
          <Text style={st.picked}>{label}</Text>

          {/* 달 이동 */}
          <View style={st.monthRow}>
            <Pressable onPress={() => setMonth(addMonth(month, -1))} style={st.navBtn} accessibilityLabel="이전 달" hitSlop={8}>
              <Text style={st.nav}>‹</Text>
            </Pressable>
            <Text style={st.month}>{y}년 {m}월</Text>
            <Pressable
              onPress={() => canNext && setMonth(addMonth(month, 1))}
              style={[st.navBtn, !canNext && { opacity: 0.25 }]}
              accessibilityLabel="다음 달"
              hitSlop={8}
            >
              <Text style={st.nav}>›</Text>
            </Pressable>
          </View>

          {/* 요일 */}
          <View style={st.week}>
            {WEEK.map((w, i) => (
              <Text key={w} style={[st.weekDay, i === 0 && { color: "#C62828" }, i === 6 && { color: C.brand }]}>{w}</Text>
            ))}
          </View>

          {/* 날짜 */}
          <View style={st.grid}>
            {days.map((d, i) => {
              if (!d) return <View key={`e${i}`} style={st.cell} />;
              const end = to ?? from;
              const isEdge = d === from || d === to;
              const inRange = !!from && !!end && d > from && d < end;
              const future = d > today;
              return (
                <Pressable
                  key={d}
                  onPress={() => tap(d)}
                  disabled={future}
                  style={[st.cell, inRange && st.inRange]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isEdge, disabled: future }}
                  accessibilityLabel={pretty(d)}
                >
                  <View style={[st.dayDot, isEdge && st.edge, d === today && !isEdge && st.todayRing]}>
                    <Text style={[st.day, future && { color: C.faint }, isEdge && { color: "#fff", fontWeight: "800" }]}>
                      {Number(d.slice(8))}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* 버튼 */}
          <View style={st.btnRow}>
            <Pressable onPress={onClose} style={[st.btn, st.btnLine]} accessibilityRole="button">
              <Text style={[st.btnText, { color: C.ink }]}>취소</Text>
            </Pressable>
            <Pressable
              onPress={() => from && onApply({ from, to: to ?? from })}
              disabled={!from}
              style={[st.btn, st.btnPrimary, !from && { opacity: 0.4 }]}
              accessibilityRole="button"
            >
              <Text style={[st.btnText, { color: "#fff" }]}>적용</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** 2026-11-05 → "11월 5일" */
export function pretty(ymd: string) {
  return `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일`;
}

/** 칩에 쓸 짧은 글: 11/1 ~ 11/5 (하루면 11/5) */
export function shortRange(r: Range) {
  const s = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return r.from === r.to ? s(r.from) : `${s(r.from)} ~ ${s(r.to)}`;
}

function firstOfMonth(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}

function addMonth(first: string, n: number) {
  const [y, m] = first.split("-").map(Number);
  return localYmd(new Date(y, m - 1 + n, 1));
}

/** 그 달의 칸 (앞쪽 빈칸 + 날짜들) */
function monthGrid(first: string): (string | null)[] {
  const [y, m] = first.split("-").map(Number);
  const lead = new Date(y, m - 1, 1).getDay();
  const count = new Date(y, m, 0).getDate();
  return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => localYmd(new Date(y, m - 1, i + 1)))];
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 16 },
  sheet: { backgroundColor: C.card, borderRadius: 22, padding: 18, maxWidth: 420, width: "100%", alignSelf: "center" },
  title: { fontSize: F.lg, fontWeight: "800", color: C.ink },
  picked: { fontSize: F.md, fontWeight: "700", color: C.brandDark, marginTop: 6, minHeight: 24 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  navBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: C.bg },
  nav: { fontSize: 26, color: C.ink, lineHeight: 30 },
  month: { fontSize: F.lg, fontWeight: "800", color: C.ink },
  week: { flexDirection: "row", marginTop: 12 },
  weekDay: { width: `${100 / 7}%`, textAlign: "center", fontSize: F.sm, color: C.sub, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  cell: { width: `${100 / 7}%`, height: 46, alignItems: "center", justifyContent: "center" },
  inRange: { backgroundColor: C.brandSoft },
  dayDot: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  edge: { backgroundColor: C.brand },
  todayRing: { borderWidth: 1.5, borderColor: C.brand },
  day: { fontSize: F.md, color: C.ink },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: { flex: 1, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnLine: { borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  btnPrimary: { backgroundColor: C.brand },
  btnText: { fontSize: F.md, fontWeight: "700" },
});

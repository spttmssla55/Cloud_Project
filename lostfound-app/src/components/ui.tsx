/**
 * 여러 화면에서 같이 쓰는 작은 부품들
 */
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View, type PressableProps, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { SOURCE_LABEL, categoryEmoji, hasPhoto, relDate } from "@/lib/format";
import { C, F, STATUS_COLOR } from "@/lib/theme";
import type { FoundItem } from "@/lib/types";

/** 사진 (없으면 종류별 그림) */
export function Thumb({ item, size = 88, uri }: { item: FoundItem; size?: number | "full"; uri?: string }) {
  const src = uri ?? (hasPhoto(item.fdFilePathImg) ? item.fdFilePathImg : undefined);
  const box: ViewStyle & ImageStyle = size === "full" ? { width: "100%", aspectRatio: 4 / 3 } : { width: size, height: size };
  const emoji = size === "full" ? 80 : Math.round((size as number) * 0.42);
  return src ? (
    <Image source={{ uri: src }} style={[box as ImageStyle, { borderRadius: 14 }]} accessibilityLabel={item.fdPrdtNm} />
  ) : (
    <View style={[box as ViewStyle, s.thumbEmpty]}>
      <Text style={{ fontSize: emoji }}>{categoryEmoji(item.prdtClNm)}</Text>
    </View>
  );
}

export function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function SourceBadge({ source }: { source: FoundItem["source"] }) {
  return source === "user" ? (
    <Badge text={SOURCE_LABEL.user} bg={C.reportSoft} fg={C.report} />
  ) : (
    <Badge text={SOURCE_LABEL[source]} bg={C.brandSoft} fg={C.brandDark} />
  );
}

export function StatusBadge({ status }: { status: FoundItem["status"] }) {
  return <Badge text={status} {...STATUS_COLOR[status]} />;
}

/** 목록 카드: 물건 이름 → 어디 있는지 → 언제, 순서로 크게 */
export function ItemCard({ item }: { item: FoundItem }) {
  const where = item.source === "user" ? item.currentPlace ?? item.depPlace : item.depPlace;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/item/[id]", params: { id: item.atcId, sn: item.fdSn } })}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
    >
        <Thumb item={item} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.badges}>
            <SourceBadge source={item.source} />
            <StatusBadge status={item.status} />
          </View>
          <Text style={s.title} numberOfLines={1}>{item.fdPrdtNm}</Text>
          <Text style={s.sub} numberOfLines={1}>
            {item.prdtClNm}
            {item.clrNm ? ` · ${item.clrNm}` : ""}
          </Text>
          <View style={s.whereRow}>
            <Text style={s.where} numberOfLines={1}>📍 {where}</Text>
            <Text style={s.date}>{relDate(item.fdYmd)}</Text>
          </View>
        </View>
    </Pressable>
  );
}

/** 큰 버튼 (높이 52) */
export function Button({
  title,
  kind = "primary",
  style,
  ...rest
}: PressableProps & { title: string; kind?: "primary" | "line"; style?: StyleProp<ViewStyle> }) {
  const primary = kind === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, primary ? s.btnPrimary : s.btnLine, pressed && { opacity: 0.75 }, rest.disabled && { opacity: 0.4 }, style]}
      {...rest}
    >
      <Text style={[s.btnText, { color: primary ? "#fff" : C.ink }]}>{title}</Text>
    </Pressable>
  );
}

/** 동그란 선택 칩 */
export function Chip({ label, on, onPress, disabled }: { label: string; on?: boolean; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      style={[s.chip, on && s.chipOn, disabled && { opacity: 0.35 }]}
    >
      <Text style={[s.chipText, on && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  thumbEmpty: { borderRadius: 14, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: F.xs, fontWeight: "700" },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 4 },
  card: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.line,
  },
  title: { fontSize: F.lg, fontWeight: "700", color: C.ink },
  sub: { fontSize: F.sm, color: C.sub, marginTop: 1 },
  whereRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 8 },
  where: { flex: 1, fontSize: F.sm, color: C.ink2 },
  date: { fontSize: F.sm, color: C.sub },
  btn: { minHeight: 52, borderRadius: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: C.brand },
  btnLine: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  btnText: { fontSize: F.md, fontWeight: "700" },
  chip: {
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: F.sm, fontWeight: "600", color: C.ink2 },
});

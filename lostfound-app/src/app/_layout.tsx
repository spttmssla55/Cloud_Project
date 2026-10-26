/**
 * 앱 전체 틀: 아래 탭(목록·챗봇) 위에 상세 화면이 쌓이는 구조
 */
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { C } from "@/lib/theme";

export default function RootLayout() {
  return (
    <>
      {/* 휴대폰이 다크 모드여도 밝은 화면으로 통일 (글자가 잘 보이게) */}
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: C.ink,
          headerStyle: { backgroundColor: C.card },
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: C.bg },
          headerBackTitle: "뒤로",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="item/[id]" options={{ title: "습득물 자세히" }} />
      </Stack>
    </>
  );
}

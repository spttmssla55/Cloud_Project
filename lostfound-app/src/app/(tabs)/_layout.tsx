/**
 * 아래 탭 두 개: 목록 / 챗봇
 */
import { Tabs } from "expo-router/js-tabs";
import { Text } from "react-native";
import { SITE_NAME } from "@/lib/site";
import { C, F } from "@/lib/theme";

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.sub,
        tabBarLabelStyle: { fontSize: F.xs, fontWeight: "700" },
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.line },
        headerStyle: { backgroundColor: C.card },
        headerTitleStyle: { fontSize: F.lg, fontWeight: "800", color: C.ink },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: SITE_NAME, tabBarLabel: "목록", tabBarIcon: icon("🗂️") }} />
      <Tabs.Screen name="chat" options={{ title: "챗봇으로 등록·찾기", tabBarLabel: "챗봇", tabBarIcon: icon("💬") }} />
    </Tabs>
  );
}

/**
 * 로그인 화면 (챗봇 등 다른 곳에서 올 때). 로그인하면 원래 화면으로 돌아간다
 */
import { router } from "expo-router";
import { LoginForm } from "@/components/auth";

export default function LoginScreen() {
  return <LoginForm onDone={() => (router.canGoBack() ? router.back() : router.replace("/my"))} />;
}

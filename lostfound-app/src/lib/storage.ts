/**
 * 휴대폰: AsyncStorage (설치: npx expo install @react-native-async-storage/async-storage)
 * 웹은 storage.web.ts (localStorage) 를 쓴다
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function load<T>(key: string): Promise<T | null> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
export async function save(key: string, value: unknown): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 무시 */
  }
}

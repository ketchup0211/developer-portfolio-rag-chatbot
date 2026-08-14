// OpenAI 서버 전용 클라이언트. OPENAI_API_KEY는 진짜 비밀 키이므로,
// 이 파일은 반드시 서버 쪽 코드(API Route)에서만 import한다.
import OpenAI from "openai";

let client;

export function getOpenAIClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

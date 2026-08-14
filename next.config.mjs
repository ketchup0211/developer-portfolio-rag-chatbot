import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 홈 폴더 등 상위 경로의 다른 package-lock.json과 혼동하지 않도록
  // 이 프로젝트 폴더를 Turbopack 루트로 명시합니다.
  turbopack: {
    root: __dirname,
  },
  // pdf-parse(내부적으로 pdfjs-dist 사용)는 서버 번들에 그대로 묶이면 워커 파일 경로를
  // 못 찾는 문제가 있어, Next가 번들링하지 않고 Node의 require로 직접 불러오게 한다.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;

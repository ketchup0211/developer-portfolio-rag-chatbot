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
};

export default nextConfig;

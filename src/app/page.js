// 별도의 홈 화면 없이, 루트 경로는 바로 포트폴리오 화면(/portfolio)으로 보낸다.
// 로그인 여부에 따른 화면 구성(관리자 버튼 노출 등)은 /portfolio 자체가 처리한다.
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/portfolio");
}

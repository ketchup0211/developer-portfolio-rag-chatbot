// 아직 지원하지 않는 블록 타입을 만났을 때의 안전한 대체 화면.
// 운영 환경에서는 조용히 건너뛰어 페이지 전체 흐름을 방해하지 않고,
// 개발 중에는 어떤 타입이 빠졌는지 바로 알 수 있도록 표시한다.
export default function Unsupported({ type }) {
  if (process.env.NODE_ENV === "production") return null;
  return <p className="notion-unsupported">(지원하지 않는 콘텐츠 형식: {type})</p>;
}

// 페이지 안에 연결된(인라인) 데이터베이스. 이번 범위에서는 그 데이터베이스 내용을
// 직접 쿼리해서 보여주지 않고, 노션에서 확인하도록 안내만 한다.
export default function ChildDatabase({ block }) {
  const title = block.data?.title || "연결된 데이터베이스";
  return (
    <p className="notion-unsupported">
      🗄️ {title} — 이 항목은 노션에서 직접 확인해주세요.
    </p>
  );
}

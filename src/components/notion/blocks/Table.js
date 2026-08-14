import RichText from "../RichText";

// table 블록의 children은 fetchBlocksRecursive가 이미 가져온 table_row들이다.
// (NotionBlock 디스패처는 table_row를 단독으로 만나면 아무것도 그리지 않는다 —
//  여기서 block.children으로 직접 순회해 <table>을 구성한다)
export default function Table({ block }) {
  const rows = block.children || [];
  const { has_column_header, has_row_header } = block.data;

  if (rows.length === 0) return null;

  return (
    <div className="notion-table-wrap">
      <table className="notion-table">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id}>
              {(row.data?.cells || []).map((cell, cellIndex) => {
                const isHeaderCell =
                  (has_column_header && rowIndex === 0) ||
                  (has_row_header && cellIndex === 0);
                const Cell = isHeaderCell ? "th" : "td";
                return (
                  <Cell key={cellIndex}>
                    <RichText richText={cell} />
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

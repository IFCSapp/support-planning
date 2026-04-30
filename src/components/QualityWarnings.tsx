import type { QualityWarning } from "../types/plan";

export default function QualityWarnings({ warnings }: { warnings: QualityWarning[] }) {
  if (!warnings.length) return <p className="ok">品質チェック: 注意はありません。</p>;
  return (
    <div className="warnings">
      <strong>品質チェック</strong>
      <ul>
        {warnings.map((warning) => (
          <li key={`${warning.id}-${warning.target}`} className={warning.level}>
            {warning.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

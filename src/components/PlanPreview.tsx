import type { PlanBlock } from "../types/plan";
import CopyButtons from "./CopyButtons";
import QualityWarnings from "./QualityWarnings";

type Props = {
  block: PlanBlock;
  onChange: (patch: Partial<PlanBlock>) => void;
  onCopied: () => void;
};

export default function PlanPreview({ block, onChange, onCopied }: Props) {
  const text = [block.directionText, block.actionText, block.staffSupportText].filter(Boolean).join("\n\n");

  function updateText(value: string) {
    const parts = value.split(/\n\s*\n/);
    onChange({
      directionText: parts[0] ?? "",
      actionText: parts[1] ?? "",
      staffSupportText: parts.slice(2).join("\n\n"),
    });
  }

  return (
    <section className="preview-panel">
      <h2>3文確認</h2>
      <div className="connected-preview">
        <p>{block.directionText || "方向性文が入ります。"}</p>
        <p>{block.actionText || "行動文が入ります。"}</p>
        <p>{block.staffSupportText || "職員支援文が入ります。"}</p>
      </div>
      <label>
        文章を調整
        <textarea className="large-textarea" value={text} onChange={(event) => updateText(event.target.value)} />
      </label>
      <QualityWarnings warnings={block.qualityWarnings} />
      <CopyButtons block={block} onCopied={onCopied} />
    </section>
  );
}

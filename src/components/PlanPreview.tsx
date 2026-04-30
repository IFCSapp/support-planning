import type { PlanBlock } from "../types/plan";
import CopyButtons from "./CopyButtons";
import QualityWarnings from "./QualityWarnings";

type Props = {
  block: PlanBlock;
  onCopied: () => void;
};

export default function PlanPreview({ block, onCopied }: Props) {
  return (
    <section className="preview-panel">
      <h2>3文確認</h2>
      <div className="connected-preview">
        <p>{block.directionText || "方向性文が入ります。"}</p>
        <p>{block.actionText || "行動文が入ります。"}</p>
        <p>{block.staffSupportText || "職員支援文が入ります。"}</p>
      </div>
      <QualityWarnings warnings={block.qualityWarnings} />
      <CopyButtons block={block} onCopied={onCopied} />
    </section>
  );
}

import type { SupportPlanDraft, PlanBlock } from "../types/plan";
import { blockText } from "../logic/generateTexts";
import { planFullText } from "../logic/exportText";

type Props = {
  block?: PlanBlock;
  plan?: SupportPlanDraft;
  onCopied: () => void;
};

export default function CopyButtons({ block, plan, onCopied }: Props) {
  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    onCopied();
  }
  return (
    <div className="button-row no-print">
      {block && <button onClick={() => copy(blockText(block))}>文章をコピー</button>}
      {plan && <button className="primary" onClick={() => copy(planFullText(plan))}>計画全文をコピー</button>}
    </div>
  );
}

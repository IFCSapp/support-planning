import type { SupportPlanDictionary } from "../types/dictionary";
import type { PlanBlock, QualityWarning } from "../types/plan";

const builtInAvoid = ["本人は", "していく", "目指していきましょう", "することを目指しましょう", "不安をなくす", "自信をつける", "やる気を出す", "ちゃんとする", "意識する", "理解する", "頑張る", "克服する"];

export function validatePlanBlock(block: PlanBlock, dictionary: SupportPlanDictionary): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  const texts = [
    ["direction", block.directionText],
    ["action", block.actionText],
    ["support", block.staffSupportText],
    ["monitoring", block.monitoringText ?? ""],
  ] as const;
  const avoidPhrases = [...builtInAvoid, ...dictionary.avoidPhrases.map((item) => item.phrase)].filter(Boolean);

  texts.forEach(([target, text]) => {
    avoidPhrases.forEach((phrase) => {
      if (text.includes(phrase)) {
        warnings.push({
          id: `${target}-${phrase}`,
          level: "warning",
          target,
          message: `「${phrase}」は避ける表現です。`,
        });
      }
    });
  });

  if (!block.directionText.trim()) warnings.push(warn("direction-empty", "warning", "direction", "方向性文が空欄です。"));
  if (block.directionText.includes("せず") || block.directionText.includes("ではなく")) warnings.push(warn("direction-contrast", "warning", "direction", "方向性文が対比文になっている可能性があります。"));
  if (block.directionText && !block.directionText.endsWith("ましょう。")) warnings.push(warn("direction-ending", "info", "direction", "方向性文は「ましょう。」で終えると本人向けの提案文になります。"));

  if (!block.actionText.trim()) warnings.push(warn("action-empty", "warning", "action", "行動文が空欄です。"));
  if (block.actionText && !block.actionText.includes("とき") && !block.actionText.includes("場面") && !block.actionText.includes("前") && !block.actionText.includes("中")) warnings.push(warn("action-situation", "warning", "action", "行動文に場面が含まれていない可能性があります。"));
  if (block.actionText && !/[てで]みましょう。$/.test(block.actionText.trim())) warnings.push(warn("action-ending", "info", "action", "行動文は「してみましょう。」や「入れてみましょう。」などの形で終えると読みやすくなります。"));

  if (!block.staffSupportText.trim()) warnings.push(warn("support-empty", "warning", "support", "職員支援文が空欄です。"));
  if (block.staffSupportText && !block.staffSupportText.startsWith("職員は")) warnings.push(warn("support-subject", "warning", "support", "職員支援文は「職員は」で始めてください。"));
  if (block.staffSupportText && !block.staffSupportText.endsWith("支援します。")) warnings.push(warn("support-ending", "info", "support", "職員支援文は「支援します。」で終える形を確認してください。"));
  if (/本人が.*(頑張|自立)|見守ります|必要に応じて支援/.test(block.staffSupportText)) warnings.push(warn("support-operation", "warning", "support", "具体的な支援操作が不足している可能性があります。"));

  return warnings;
}

function warn(id: string, level: QualityWarning["level"], target: QualityWarning["target"], message: string): QualityWarning {
  return { id, level, target, message };
}

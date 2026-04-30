import type { SupportPlanDraft } from "../types/plan";
import { blockText } from "./generateTexts";

export function planFullText(plan: SupportPlanDraft): string {
  const hopes = [
    plan.personHope.originalWords,
    plan.personHope.workHope,
    plan.personHope.trainingHope,
    plan.personHope.concerns,
    plan.personHope.desiredChanges,
  ].filter(Boolean).join("\n");

  return [
    `利用者表示名: ${plan.clientInfo.displayName || "未入力"}`,
    `計画期間: ${plan.clientInfo.planStartDate || ""} - ${plan.clientInfo.planEndDate || ""}`,
    `担当職員: ${plan.clientInfo.staffName || ""}`,
    "",
    "【本人の希望】",
    hopes,
    "",
    ...plan.blocks.map((block, index) => `【支援計画 ${index + 1}】\n${blockText(block)}`),
    "",
    "【面談メモ】",
    plan.interviewMemo || "",
  ].join("\n");
}

import type { GenerationRule } from "../types/dictionary";

export function suggestIdeas(rules: GenerationRule[], triggerIds: string[], actNoticeIds: string[]): GenerationRule[] {
  if (!triggerIds.length && !actNoticeIds.length) return [];
  return rules
    .map((rule) => {
      const triggerScore = rule.triggerIds?.filter((id) => triggerIds.includes(id)).length ?? 0;
      const noticeScore = rule.actNoticeIds?.filter((id) => actNoticeIds.includes(id)).length ?? 0;
      return { rule, score: triggerScore + noticeScore + (triggerScore && noticeScore ? 2 : 0) };
    })
    .filter((item) => item.score > 0 || item.rule.suggestedShortGoal || item.rule.suggestedSupportOperation)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.rule);
}

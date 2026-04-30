import type { GenerationRule } from "../types/dictionary";

export function suggestIdeas(rules: GenerationRule[], triggerIds: string[], actNoticeIds: string[]): GenerationRule[] {
  if (!triggerIds.length && !actNoticeIds.length) return [];

  return rules
    .map((rule) => {
      const triggerScore = rule.triggerIds?.filter((id) => triggerIds.includes(id)).length ?? 0;
      const noticeScore = rule.actNoticeIds?.filter((id) => actNoticeIds.includes(id)).length ?? 0;
      const bothMatched = triggerScore > 0 && noticeScore > 0;
      return { rule, score: triggerScore + noticeScore + (bothMatched ? 2 : 0) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.rule);
}

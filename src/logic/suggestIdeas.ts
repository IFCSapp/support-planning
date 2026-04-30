import type { ActNoticeEntry, GenerationRule, TriggerEntry } from "../types/dictionary";

export function suggestIdeas(
  rules: GenerationRule[],
  triggerIds: string[],
  actNoticeIds: string[],
  triggers: TriggerEntry[] = [],
  actNotices: ActNoticeEntry[] = [],
): GenerationRule[] {
  if (!triggerIds.length && !actNoticeIds.length) return [];

  const triggerById = new Map(triggers.map((item) => [item.id, item]));
  const noticeById = new Map(actNotices.map((item) => [item.id, item]));
  const selectedTriggerCategories = categoriesForIds(triggerIds, triggerById);
  const selectedNoticeCategories = categoriesForIds(actNoticeIds, noticeById);

  const matchedRules = rules
    .map((rule) => {
      const triggerScore = rule.triggerIds?.filter((id) => triggerIds.includes(id)).length ?? 0;
      const noticeScore = rule.actNoticeIds?.filter((id) => actNoticeIds.includes(id)).length ?? 0;
      const triggerCategoryScore = countCategoryMatches(rule.triggerIds, triggerById, selectedTriggerCategories);
      const noticeCategoryScore = countCategoryMatches(rule.actNoticeIds, noticeById, selectedNoticeCategories);
      const bothMatched = triggerScore > 0 && noticeScore > 0;
      const exactScore = triggerScore + noticeScore + (bothMatched ? 2 : 0);
      return { rule, score: exactScore + (triggerCategoryScore + noticeCategoryScore) * 0.5 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.rule);

  return uniqueRules([...matchedRules, ...fallbackRules(triggerIds, actNoticeIds, triggerById, noticeById)]).slice(0, 6);
}

function fallbackRules(
  triggerIds: string[],
  actNoticeIds: string[],
  triggerById: Map<string, TriggerEntry>,
  noticeById: Map<string, ActNoticeEntry>,
): GenerationRule[] {
  const selectedTriggers = triggerIds.map((id) => triggerById.get(id)).filter(Boolean) as TriggerEntry[];
  const selectedNotices = actNoticeIds.map((id) => noticeById.get(id)).filter(Boolean) as ActNoticeEntry[];
  const categories = uniqueStrings([...selectedTriggers, ...selectedNotices].map((item) => item.category));
  const labels = uniqueStrings([...selectedTriggers, ...selectedNotices].map((item) => item.label));
  if (!categories.length && !labels.length) return [];

  return [
    {
      id: ["fallback", ...triggerIds, ...actNoticeIds].join("-"),
      triggerIds,
      actNoticeIds,
      triggerLabels: selectedTriggers.map((item) => item.label),
      actNoticeLabels: selectedNotices.map((item) => item.label),
      suggestedSupportOperation: uniqueStrings([...categories, ...labels]).join(" "),
      description: uniqueStrings([...categories, ...labels]).join(" / "),
    },
  ];
}

function categoriesForIds<T extends { id: string; category: string }>(ids: string[], byId: Map<string, T>): Set<string> {
  return new Set(ids.map((id) => byId.get(id)?.category).filter(Boolean) as string[]);
}

function countCategoryMatches<T extends { id: string; category: string }>(ids: string[] | undefined, byId: Map<string, T>, selectedCategories: Set<string>): number {
  if (!ids?.length || !selectedCategories.size) return 0;
  return uniqueStrings(ids.map((id) => byId.get(id)?.category ?? "")).filter((category) => selectedCategories.has(category)).length;
}

function uniqueRules(rules: GenerationRule[]): GenerationRule[] {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    if (seen.has(rule.id)) return false;
    seen.add(rule.id);
    return true;
  });
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

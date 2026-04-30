import type {
  ActionEntry,
  ActNoticeEntry,
  AvoidPhraseEntry,
  DirectionEntry,
  GenerationRule,
  MonitoringEntry,
  StaffSupportEntry,
  SupportDomain,
  SupportPlanDictionary,
  SituationEntry,
  TriggerEntry,
} from "../types/dictionary";

type RawRecord = Record<string, unknown>;

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asString = (value: unknown): string => (typeof value === "string" ? value : "");

function domainIds(entry: RawRecord, fallback: string): string[] {
  const ids = entry.domainIds;
  if (Array.isArray(ids)) return ids.map(String);
  return [asString(entry.domainId) || fallback].filter(Boolean);
}

export async function loadDictionary(): Promise<SupportPlanDictionary> {
  const response = await fetch("/data/support_plan_dictionary_v0_2_1.json", { cache: "no-cache" });
  if (!response.ok) {
    throw new Error("辞書データを読み込めませんでした。dataフォルダに辞書JSONが配置されているか確認してください。");
  }
  return normalizeDictionary((await response.json()) as RawRecord);
}

export function normalizeDictionary(raw: RawRecord): SupportPlanDictionary {
  const directions: DirectionEntry[] = [];
  const situations: SituationEntry[] = [];
  const actions: ActionEntry[] = [];
  const staffSupports: StaffSupportEntry[] = [];
  const monitorings: MonitoringEntry[] = [];

  const domains: SupportDomain[] = asArray<RawRecord>(raw.domains).map((domain) => {
    const id = asString(domain.id);
    const domainDirections = asArray<RawRecord>(domain.directions);
    const domainSituations = asArray<RawRecord>(domain.situations);
    const domainActions = asArray<RawRecord>(domain.actions);
    const domainSupports = asArray<RawRecord>(domain.supports ?? domain.staffSupports);
    const domainMonitorings = asArray<RawRecord>(domain.monitoringPoints ?? domain.monitorings);
    const shortGoals = asArray<RawRecord | string>(domain.shortGoals).map((goal) =>
      typeof goal === "string" ? goal : asString(goal.text || goal.label),
    );

    domainDirections.forEach((entry) =>
      directions.push({
        id: asString(entry.id),
        domainIds: domainIds(entry, id),
        label: asString(entry.label || entry.text),
        sentence: asString(entry.sentence) || undefined,
      }),
    );
    domainSituations.forEach((entry) =>
      situations.push({
        id: asString(entry.id),
        domainIds: domainIds(entry, id),
        label: asString(entry.label || entry.text),
        sentence: asString(entry.sentence) || undefined,
      }),
    );
    domainActions.forEach((entry) =>
      actions.push({
        id: asString(entry.id),
        domainIds: domainIds(entry, id),
        label: asString(entry.label || entry.base || entry.text),
        sentence: asString(entry.sentence) || undefined,
        shortGoal: asString(entry.shortGoal) || undefined,
        teForm: asString(entry.teForm) || undefined,
      }),
    );
    domainSupports.forEach((entry) => {
      const lead = asString(entry.lead || entry.supportLead || entry.label || entry.text);
      const ending = asString(entry.ending);
      const sentence = asString(entry.sentence) || (lead && ending ? `職員は、${lead}、${ending}。` : undefined);
      staffSupports.push({
        id: asString(entry.id),
        domainIds: domainIds(entry, id),
        label: asString(entry.label || entry.text || lead),
        sentence,
        ending: ending || undefined,
        lead: lead || undefined,
      });
    });
    domainMonitorings.forEach((entry) =>
      monitorings.push({
        id: asString(entry.id),
        domainIds: domainIds(entry, id),
        label: asString(entry.label || entry.text),
        sentence: asString(entry.sentence || entry.text) || undefined,
      }),
    );

    return {
      id,
      label: asString(domain.label),
      description: asString(domain.description || domain.goal) || undefined,
      shortGoals,
      directionIds: domainDirections.map((entry) => asString(entry.id)),
      situationIds: domainSituations.map((entry) => asString(entry.id)),
      actionIds: domainActions.map((entry) => asString(entry.id)),
      supportIds: domainSupports.map((entry) => asString(entry.id)),
      monitoringIds: domainMonitorings.map((entry) => asString(entry.id)),
    };
  });

  const triggers = normalizeTriggers(raw);
  const actNotices = normalizeActNotices(raw);

  return {
    version: asString(raw.version || raw.schemaVersion || raw.revision && (raw.revision as RawRecord).version) || "unknown",
    domains,
    directions: directions.length ? directions : asArray<DirectionEntry>(raw.directions),
    situations: situations.length ? situations : asArray<SituationEntry>(raw.situations),
    actions: actions.length ? actions : asArray<ActionEntry>(raw.actions),
    staffSupports: staffSupports.length ? staffSupports : asArray<StaffSupportEntry>(raw.staffSupports),
    monitorings: monitorings.length ? monitorings : asArray<MonitoringEntry>(raw.monitorings),
    triggers,
    actNotices,
    generationRules: normalizeRules(raw, triggers, actNotices),
    avoidPhrases: normalizeAvoidPhrases(raw),
  };
}

function normalizeTriggers(raw: RawRecord): TriggerEntry[] {
  return asArray<RawRecord>(raw.triggers ?? raw.antecedents).map((entry) => ({
    id: asString(entry.id),
    category: asString(entry.category),
    label: asString(entry.label || entry.text),
  }));
}

function normalizeActNotices(raw: RawRecord): ActNoticeEntry[] {
  return asArray<RawRecord>(raw.actNotices ?? raw.notices).map((entry) => ({
    id: asString(entry.id),
    category: asString(entry.category),
    label: asString(entry.label || entry.text),
  }));
}

function normalizeAvoidPhrases(raw: RawRecord): AvoidPhraseEntry[] {
  return asArray<RawRecord>(raw.avoidPhrases).map((entry) => ({
    phrase: asString(entry.phrase || entry.avoid),
    replacements: asArray<string>(entry.replacements || entry.replaceWith).map(String),
    reason: asString(entry.reason) || undefined,
  }));
}

function normalizeRules(raw: RawRecord, triggers: TriggerEntry[], actNotices: ActNoticeEntry[]): GenerationRule[] {
  return asArray<RawRecord>(raw.generationRules).map((entry) => {
    const match = (entry.match || {}) as RawRecord;
    const recommend = (entry.recommend || {}) as RawRecord;
    const triggerLabels = asArray<string>(match.antecedentIncludes).map(String).filter(Boolean);
    const actNoticeLabels = asArray<string>(match.noticeIncludes).map(String).filter(Boolean);
    const triggerIdsFromLabels = labelsToIds(triggerLabels, triggers);
    const noticeIdsFromLabels = labelsToIds(actNoticeLabels, actNotices);

    return {
      id: asString(entry.id),
      triggerIds: uniqueStrings([...asArray<string>(entry.triggerIds).map(String), ...triggerIdsFromLabels]),
      actNoticeIds: uniqueStrings([...asArray<string>(entry.actNoticeIds).map(String), ...noticeIdsFromLabels]),
      suggestedDirectionIds: asArray<string>(entry.suggestedDirectionIds).map(String),
      suggestedActionIds: asArray<string>(entry.suggestedActionIds).map(String),
      suggestedSupportIds: asArray<string>(entry.suggestedSupportIds).map(String),
      suggestedMonitoringIds: asArray<string>(entry.suggestedMonitoringIds).map(String),
      suggestedShortGoal: asString(recommend.shortGoal) || undefined,
      suggestedSupportOperation: asString(recommend.supportOperation) || undefined,
      triggerLabels,
      actNoticeLabels,
      description: asString(entry.description || entry.logic) || undefined,
    };
  });
}

function labelsToIds<T extends { id: string; label: string }>(labels: string[], entries: T[]): string[] {
  return labels.flatMap((label) => {
    const normalizedLabel = label.trim();
    return entries
      .filter((entry) => entry.label === normalizedLabel || entry.label.includes(normalizedLabel) || normalizedLabel.includes(entry.label))
      .map((entry) => entry.id);
  });
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

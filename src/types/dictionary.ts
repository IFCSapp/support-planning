export type DictionaryVersion = string;

export type SupportDomain = {
  id: string;
  label: string;
  description?: string;
  shortGoals?: string[];
  directionIds?: string[];
  situationIds?: string[];
  actionIds?: string[];
  supportIds?: string[];
  monitoringIds?: string[];
};

export type DirectionEntry = {
  id: string;
  domainIds: string[];
  label: string;
  sentence?: string;
  tags?: string[];
};

export type SituationEntry = {
  id: string;
  domainIds: string[];
  label: string;
  sentence?: string;
  tags?: string[];
};

export type ActionEntry = {
  id: string;
  domainIds: string[];
  label: string;
  sentence?: string;
  shortGoal?: string;
  teForm?: string;
  tags?: string[];
};

export type StaffSupportEntry = {
  id: string;
  domainIds: string[];
  label: string;
  sentence?: string;
  ending?: string;
  lead?: string;
  tags?: string[];
};

export type MonitoringEntry = {
  id: string;
  domainIds: string[];
  label: string;
  sentence?: string;
  tags?: string[];
};

export type TriggerEntry = {
  id: string;
  category: string;
  label: string;
  tags?: string[];
};

export type ActNoticeEntry = {
  id: string;
  category: string;
  label: string;
  tags?: string[];
};

export type GenerationRule = {
  id: string;
  triggerIds?: string[];
  actNoticeIds?: string[];
  suggestedDirectionIds?: string[];
  suggestedActionIds?: string[];
  suggestedSupportIds?: string[];
  suggestedMonitoringIds?: string[];
  suggestedShortGoal?: string;
  suggestedSupportOperation?: string;
  description?: string;
};

export type AvoidPhraseEntry = {
  phrase: string;
  replacements: string[];
  reason?: string;
};

export type SupportPlanDictionary = {
  version: DictionaryVersion;
  domains: SupportDomain[];
  directions: DirectionEntry[];
  situations: SituationEntry[];
  actions: ActionEntry[];
  staffSupports: StaffSupportEntry[];
  monitorings: MonitoringEntry[];
  triggers: TriggerEntry[];
  actNotices: ActNoticeEntry[];
  generationRules: GenerationRule[];
  avoidPhrases: AvoidPhraseEntry[];
};

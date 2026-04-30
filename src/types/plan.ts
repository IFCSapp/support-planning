export type InterviewPurpose =
  | "new"
  | "renewal"
  | "monitoring_review"
  | "attendance_rebuild"
  | "job_search"
  | "pre_internship"
  | "post_internship"
  | "other";

export type ClientInfo = {
  displayName: string;
  planStartDate?: string;
  planEndDate?: string;
  staffName?: string;
};

export type PersonHope = {
  originalWords: string;
  workHope?: string;
  trainingHope?: string;
  concerns?: string;
  desiredChanges?: string;
};

export type QualityWarning = {
  id: string;
  level: "info" | "warning";
  message: string;
  target: "direction" | "action" | "support" | "monitoring" | "all";
};

export type PlanBlock = {
  id: string;
  domainId: string;
  directionId?: string;
  situationId?: string;
  actionId?: string;
  staffSupportId?: string;
  monitoringId?: string;
  triggerIds: string[];
  actNoticeIds: string[];
  shortGoal: string;
  directionText: string;
  actionText: string;
  staffSupportText: string;
  monitoringText?: string;
  freeMemo?: string;
  qualityWarnings: QualityWarning[];
};

export type SupportPlanDraft = {
  id: string;
  createdAt: string;
  updatedAt: string;
  dictionaryVersion: string;
  purpose: InterviewPurpose;
  purposeMemo?: string;
  clientInfo: ClientInfo;
  personHope: PersonHope;
  blocks: PlanBlock[];
  interviewMemo?: string;
  status: "draft" | "completed";
};

export type BackupFile = {
  appName: "support-plan-navi";
  appVersion: string;
  exportedAt: string;
  dictionaryVersion: string;
  plans: SupportPlanDraft[];
  settings?: Record<string, unknown>;
};

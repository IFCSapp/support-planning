import type { BackupFile, SupportPlanDraft } from "../types/plan";
import { createId } from "../utils/id";
import { getSettings, listPlans, savePlan } from "./db";

export async function createBackup(dictionaryVersion: string): Promise<BackupFile> {
  return {
    appName: "support-plan-navi",
    appVersion: "0.1.0",
    exportedAt: new Date().toISOString(),
    dictionaryVersion,
    plans: await listPlans(),
    settings: await getSettings(),
  };
}

export async function importBackup(file: BackupFile): Promise<number> {
  if (file.appName !== "support-plan-navi" || !Array.isArray(file.plans)) {
    throw new Error("支援計画ナビのバックアップJSONではありません。");
  }
  let count = 0;
  for (const plan of file.plans) {
    const imported: SupportPlanDraft = {
      ...plan,
      id: createId("plan"),
      updatedAt: new Date().toISOString(),
    };
    await savePlan(imported);
    count += 1;
  }
  return count;
}

import type { ActionEntry, DirectionEntry, MonitoringEntry, StaffSupportEntry, SupportDomain, SituationEntry } from "../types/dictionary";
import type { PlanBlock } from "../types/plan";
import { ensureJapanesePeriod } from "../utils/text";

export function ensureMashou(text: string): string {
  const trimmed = text.trim().replace(/。$/, "");
  if (!trimmed) return "";
  if (trimmed.endsWith("ましょう")) return trimmed;
  if (trimmed.endsWith("する")) return `${trimmed.slice(0, -2)}しましょう`;
  if (trimmed.endsWith("進める")) return `${trimmed.slice(0, -2)}めましょう`;
  if (trimmed.endsWith("取り組む")) return `${trimmed.slice(0, -2)}みましょう`;
  if (trimmed.endsWith("整える")) return `${trimmed.slice(0, -2)}えましょう`;
  if (trimmed.endsWith("続ける")) return `${trimmed.slice(0, -2)}けましょう`;
  return `${trimmed}ましょう`;
}

export function toTryForm(label: string, teForm?: string): string {
  if (teForm) return `${teForm.replace(/。$/, "")}みましょう`;
  const text = label.trim().replace(/。$/, "");
  if (!text) return "";
  if (text.endsWith("してみましょう")) return text;
  if (text.endsWith("する")) return `${text.slice(0, -2)}してみましょう`;
  if (text.endsWith("入れる")) return `${text.slice(0, -2)}れてみましょう`;
  if (text.endsWith("選ぶ")) return `${text.slice(0, -2)}選んでみましょう`;
  if (text.endsWith("書く")) return `${text.slice(0, -2)}書いてみましょう`;
  if (text.endsWith("伝える")) return `${text.slice(0, -2)}伝えてみましょう`;
  if (text.endsWith("確認する")) return `${text.slice(0, -2)}確認してみましょう`;
  return `${text}してみましょう`;
}

export function generateDirectionText(direction?: DirectionEntry): string {
  if (!direction) return "";
  return ensureJapanesePeriod(ensureMashou(direction.sentence ?? direction.label));
}

export function generateActionText(situation?: SituationEntry, action?: ActionEntry): string {
  if (!action) return "";
  if (action.sentence) return ensureJapanesePeriod(action.sentence);
  if (!situation) return ensureJapanesePeriod(toTryForm(action.label, action.teForm));
  return ensureJapanesePeriod(`${situation.label}は、${toTryForm(action.label, action.teForm)}`);
}

export function generateStaffSupportText(support?: StaffSupportEntry): string {
  if (!support) return "";
  if (support.sentence) return ensureJapanesePeriod(support.sentence);
  const ending = support.ending ?? "取り組みやすくなるよう支援します";
  const lead = support.lead ?? normalizeSupportLabel(support.label);
  return ensureJapanesePeriod(`職員は、${lead}を行い、${ending}`);
}

function normalizeSupportLabel(label: string): string {
  return label.trim().replace(/する$/, "").replace(/。$/, "");
}

export function generateMonitoringText(monitoring?: MonitoringEntry): string {
  if (monitoring?.sentence) return ensureJapanesePeriod(monitoring.sentence);
  if (monitoring?.label) return ensureJapanesePeriod(monitoring.label);
  return "選択した行動を、どの場面で、どの支援があれば実行しやすいかを確認します。";
}

export function resolveShortGoal(action?: ActionEntry, domain?: SupportDomain): string {
  return action?.shortGoal ?? domain?.shortGoals?.[0] ?? action?.label.slice(0, 12) ?? "";
}

export function blockText(block: PlanBlock): string {
  return [
    "【方向性】",
    block.directionText,
    "",
    "【行動】",
    block.actionText,
    "",
    "【職員支援】",
    block.staffSupportText,
  ].join("\n");
}

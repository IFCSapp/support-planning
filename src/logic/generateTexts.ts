import type { ActionEntry, DirectionEntry, MonitoringEntry, StaffSupportEntry, SupportDomain, SituationEntry } from "../types/dictionary";
import type { PlanBlock } from "../types/plan";
import { ensureJapanesePeriod } from "../utils/text";

export function ensureMashou(text: string, ending = "ましょう"): string {
  const trimmed = text.trim().replace(/。$/, "");
  if (!trimmed) return "";
  const normalizedEnding = ending.trim().replace(/。$/, "") || "ましょう";
  if (trimmed.endsWith(normalizedEnding)) return trimmed;
  if (normalizedEnding !== "ましょう") return `${trimmed}${normalizedEnding}`;
  if (trimmed.endsWith("ましょう")) return trimmed;
  if (trimmed.endsWith("する")) return `${trimmed.slice(0, -2)}しましょう`;
  if (trimmed.endsWith("進める")) return `${trimmed.slice(0, -2)}めましょう`;
  if (trimmed.endsWith("取り組む")) return `${trimmed.slice(0, -2)}みましょう`;
  if (trimmed.endsWith("整える")) return `${trimmed.slice(0, -2)}えましょう`;
  if (trimmed.endsWith("続ける")) return `${trimmed.slice(0, -2)}けましょう`;
  return `${trimmed}ましょう`;
}

export function toTryForm(label: string, teForm?: string, ending = "みましょう"): string {
  const normalizedEnding = ending.trim().replace(/。$/, "") || "みましょう";
  if (teForm) return `${teForm.replace(/。$/, "")}${normalizedEnding}`;
  const text = label.trim().replace(/。$/, "");
  if (!text) return "";
  if (text.endsWith(normalizedEnding)) return text;
  if (normalizedEnding !== "みましょう") return `${text}${normalizedEnding}`;
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
  return ensureJapanesePeriod(direction.sentence ?? ensureMashou(direction.label, direction.ending));
}

export function generateActionText(situation?: SituationEntry, action?: ActionEntry): string {
  if (!action) return "";
  if (action.sentence) return ensureJapanesePeriod(action.sentence);
  const actionText = toTryForm(action.label, action.teForm, action.actionEnding);
  if (!situation) return ensureJapanesePeriod(actionText);
  const connector = situation.sentenceConnector ?? "は";
  return ensureJapanesePeriod(`${situation.label}${connector}、${actionText}`);
}

export function generateStaffSupportText(support?: StaffSupportEntry): string {
  if (!support) return "";
  if (support.sentence) return ensureJapanesePeriod(support.sentence);
  const ending = support.ending ?? "取り組みやすくなるよう支援します";
  const lead = support.lead ?? normalizeSupportLabel(support.label);
  const subject = support.subject ?? "職員は";
  const connector = support.connector ?? "を行い、";
  return ensureJapanesePeriod(`${subject}、${lead}${connector}${ending}`);
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

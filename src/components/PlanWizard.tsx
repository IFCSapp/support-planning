import { useEffect, useMemo, useState } from "react";
import type { ActNoticeEntry, GenerationRule, StaffSupportEntry, SupportPlanDictionary, TriggerEntry } from "../types/dictionary";
import type { InterviewPurpose, PlanBlock, SupportPlanDraft } from "../types/plan";
import { generateActionText, generateDirectionText, generateStaffSupportText } from "../logic/generateTexts";
import { suggestIdeas } from "../logic/suggestIdeas";
import { validatePlanBlock } from "../logic/validatePlan";
import { getPlan, savePlan } from "../storage/db";
import { createId } from "../utils/id";
import { todayString } from "../utils/date";
import PlanPreview from "./PlanPreview";
import CopyButtons from "./CopyButtons";
import QualityWarnings from "./QualityWarnings";

const steps = ["面談目的", "基本情報", "本人の希望", "支援領域", "語彙選択", "3文確認", "保存・出力"];

const purposes: Array<[InterviewPurpose, string]> = [
  ["new", "新規計画"],
  ["renewal", "更新計画"],
  ["monitoring_review", "モニタリング後の見直し"],
  ["attendance_rebuild", "欠席・遅刻後の立て直し"],
  ["job_search", "就職活動前の整理"],
  ["pre_internship", "実習前の整理"],
  ["post_internship", "実習後の振り返り"],
  ["other", "その他"],
];

type Props = {
  dictionary: SupportPlanDictionary;
  editId?: string;
  onNavigate: (route: string) => void;
  onCopied: () => void;
};

export default function PlanWizard({ dictionary, editId, onNavigate, onCopied }: Props) {
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"未保存" | "保存中" | "保存済み" | "保存エラー">("未保存");
  const [activeBlockId, setActiveBlockId] = useState("");
  const [draft, setDraft] = useState<SupportPlanDraft>(() => createDraft(dictionary.version));

  useEffect(() => {
    if (!editId) return;
    getPlan(editId).then((plan) => {
      if (!plan) return;
      setDraft(plan);
      setActiveBlockId(plan.blocks[0]?.id ?? "");
      setDirty(false);
      setSaveState("保存済み");
    });
  }, [editId]);

  useEffect(() => {
    if (!activeBlockId && draft.blocks[0]) setActiveBlockId(draft.blocks[0].id);
  }, [activeBlockId, draft.blocks]);

  useEffect(() => {
    if (!dirty) return;
    setSaveState("未保存");
    const timer = window.setTimeout(async () => {
      try {
        setSaveState("保存中");
        const next = { ...draft, updatedAt: new Date().toISOString() };
        await savePlan(next);
        setDraft(next);
        setDirty(false);
        setSaveState("保存済み");
      } catch {
        setSaveState("保存エラー");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [dirty, draft]);

  const activeBlock = draft.blocks.find((block) => block.id === activeBlockId) ?? draft.blocks[0];

  function changeDraft(updater: (current: SupportPlanDraft) => SupportPlanDraft) {
    setDraft((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }));
    setDirty(true);
  }

  function updateDraft(patch: Partial<SupportPlanDraft>) {
    changeDraft((current) => ({ ...current, ...patch }));
  }

  function updateBlock(blockId: string, patch: Partial<PlanBlock>) {
    changeDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== blockId) return block;
        const next = { ...block, ...patch };
        return { ...next, qualityWarnings: validatePlanBlock(next, dictionary) };
      }),
    }));
  }

  function setSelection(blockId: string, patch: Partial<PlanBlock>) {
    changeDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) => {
        if (block.id !== blockId) return block;
        const next = { ...block, ...patch };
        const direction = dictionary.directions.find((item) => item.id === next.directionId);
        const situation = dictionary.situations.find((item) => item.id === next.situationId);
        const action = dictionary.actions.find((item) => item.id === next.actionId);
        const support = dictionary.staffSupports.find((item) => item.id === next.staffSupportId);
        const generated = {
          ...next,
          directionText: generateDirectionText(direction),
          actionText: generateActionText(situation, action),
          staffSupportText: generateStaffSupportText(support),
          shortGoal: "",
          monitoringId: undefined,
          monitoringText: "",
        };
        return { ...generated, qualityWarnings: validatePlanBlock(generated, dictionary) };
      }),
    }));
  }

  function toggleDomain(domainId: string) {
    const exists = draft.blocks.some((block) => block.domainId === domainId);
    if (exists) {
      const nextBlocks = draft.blocks.filter((block) => block.domainId !== domainId);
      updateDraft({ blocks: nextBlocks });
      setActiveBlockId(nextBlocks[0]?.id ?? "");
      return;
    }
    const block = createBlock(domainId);
    updateDraft({ blocks: [...draft.blocks, block] });
    setActiveBlockId(block.id);
  }

  function duplicateBlock(block: PlanBlock) {
    const copy = { ...block, id: createId("block") };
    updateDraft({ blocks: [...draft.blocks, copy] });
    setActiveBlockId(copy.id);
  }

  function removeBlock(blockId: string) {
    const next = draft.blocks.filter((block) => block.id !== blockId);
    updateDraft({ blocks: next });
    setActiveBlockId(next[0]?.id ?? "");
  }

  async function complete() {
    const completed = { ...draft, status: "completed" as const, updatedAt: new Date().toISOString() };
    await savePlan(completed);
    setDirty(false);
    setSaveState("保存済み");
    onNavigate(`/plans/${completed.id}`);
  }

  return (
    <section className="page">
      <div className="button-row no-print">
        <button onClick={() => onNavigate("/plans")}>計画一覧へ戻る</button>
      </div>
      <div className="wizard-header">
        <div>
          <p className="eyebrow">{editId ? "計画編集" : "新規計画作成"} / {saveState}</p>
          <h1>{steps[step]}</h1>
        </div>
        <ol className="steps" aria-label="進捗">
          {steps.map((label, index) => (
            <li key={label} className={index === step ? "current" : index < step ? "done" : ""}>{index + 1}. {label}</li>
          ))}
        </ol>
      </div>

      {step === 0 && <StepPurpose draft={draft} updateDraft={updateDraft} />}
      {step === 1 && <StepClientInfo draft={draft} updateDraft={updateDraft} />}
      {step === 2 && <StepPersonHope draft={draft} updateDraft={updateDraft} />}
      {step === 3 && <StepDomainSelect dictionary={dictionary} draft={draft} toggleDomain={toggleDomain} />}
      {step === 4 && activeBlock && (
        <StepVocabularySelect dictionary={dictionary} blocks={draft.blocks} activeBlock={activeBlock} setActiveBlockId={setActiveBlockId} setSelection={setSelection} updateBlock={updateBlock} duplicateBlock={duplicateBlock} removeBlock={removeBlock} onCopied={onCopied} />
      )}
      {step === 5 && <ConfirmStep blocks={draft.blocks} onCopied={onCopied} />}
      {step === 6 && <OutputStep draft={draft} complete={complete} onCopied={onCopied} />}

      <div className="wizard-actions no-print">
        <button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>戻る</button>
        {step < steps.length - 1 ? (
          <button className="primary" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>次へ</button>
        ) : (
          <button className="primary" onClick={complete}>保存して完了</button>
        )}
      </div>
    </section>
  );
}

function createDraft(dictionaryVersion: string): SupportPlanDraft {
  return {
    id: createId("plan"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dictionaryVersion,
    purpose: "new",
    clientInfo: { displayName: "", planStartDate: todayString(), planEndDate: "", staffName: "" },
    personHope: { originalWords: "" },
    blocks: [],
    interviewMemo: "",
    status: "draft",
  };
}

function createBlock(domainId: string): PlanBlock {
  return {
    id: createId("block"),
    domainId,
    triggerIds: [],
    actNoticeIds: [],
    shortGoal: "",
    directionText: "",
    actionText: "",
    staffSupportText: "",
    monitoringText: "",
    qualityWarnings: [],
  };
}

function StepPurpose({ draft, updateDraft }: { draft: SupportPlanDraft; updateDraft: (patch: Partial<SupportPlanDraft>) => void }) {
  return (
    <div className="panel">
      <div className="choice-grid">
        {purposes.map(([value, label]) => (
          <label className="choice" key={value}>
            <input type="radio" checked={draft.purpose === value} onChange={() => updateDraft({ purpose: value })} />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {draft.purpose === "other" && <label>その他の内容<input value={draft.purposeMemo ?? ""} onChange={(event) => updateDraft({ purposeMemo: event.target.value })} /></label>}
    </div>
  );
}

function StepClientInfo({ draft, updateDraft }: { draft: SupportPlanDraft; updateDraft: (patch: Partial<SupportPlanDraft>) => void }) {
  const info = draft.clientInfo;
  return (
    <div className="form-grid panel">
      <p className="muted wide">利用者表示名は、イニシャルや管理番号でも構いません。</p>
      <label>利用者表示名<input value={info.displayName} onChange={(event) => updateDraft({ clientInfo: { ...info, displayName: event.target.value } })} /></label>
      <label>作成日<input type="date" value={draft.createdAt.slice(0, 10)} readOnly /></label>
      <label>計画期間開始日<input type="date" value={info.planStartDate ?? ""} onChange={(event) => updateDraft({ clientInfo: { ...info, planStartDate: event.target.value } })} /></label>
      <label>計画期間終了日<input type="date" value={info.planEndDate ?? ""} onChange={(event) => updateDraft({ clientInfo: { ...info, planEndDate: event.target.value } })} /></label>
      <label>担当職員名<input value={info.staffName ?? ""} onChange={(event) => updateDraft({ clientInfo: { ...info, staffName: event.target.value } })} /></label>
      <label className="wide">面談メモ<textarea value={draft.interviewMemo ?? ""} onChange={(event) => updateDraft({ interviewMemo: event.target.value })} /></label>
    </div>
  );
}

function StepPersonHope({ draft, updateDraft }: { draft: SupportPlanDraft; updateDraft: (patch: Partial<SupportPlanDraft>) => void }) {
  const hope = draft.personHope;
  const patch = (value: Partial<typeof hope>) => updateDraft({ personHope: { ...hope, ...value } });
  return (
    <div className="form-grid panel">
      <p className="muted wide">本人の言葉メモは計画書文にそのまま使わず、支援語彙を選ぶ材料として使います。</p>
      <label className="wide">本人の言葉メモ<textarea value={hope.originalWords} onChange={(event) => patch({ originalWords: event.target.value })} /></label>
      <label>働き方の希望<textarea value={hope.workHope ?? ""} onChange={(event) => patch({ workHope: event.target.value })} /></label>
      <label>通所・訓練に関する希望<textarea value={hope.trainingHope ?? ""} onChange={(event) => patch({ trainingHope: event.target.value })} /></label>
      <label>避けたいこと、心配なこと<textarea value={hope.concerns ?? ""} onChange={(event) => patch({ concerns: event.target.value })} /></label>
      <label>できるようになりたいこと<textarea value={hope.desiredChanges ?? ""} onChange={(event) => patch({ desiredChanges: event.target.value })} /></label>
    </div>
  );
}

function StepDomainSelect({ dictionary, draft, toggleDomain }: { dictionary: SupportPlanDictionary; draft: SupportPlanDraft; toggleDomain: (id: string) => void }) {
  const selected = new Set(draft.blocks.map((block) => block.domainId));
  const selectedDomains = dictionary.domains.filter((domain) => selected.has(domain.id));
  const unselectedDomains = dictionary.domains.filter((domain) => !selected.has(domain.id));
  const domains = [...selectedDomains, ...unselectedDomains];

  return (
    <div className="domain-layout">
      <aside className="hope-frame">
        <h2>本人の希望</h2>
        <HopeItem label="本人の言葉" value={draft.personHope.originalWords} />
        <HopeItem label="働き方" value={draft.personHope.workHope} />
        <HopeItem label="通所・訓練" value={draft.personHope.trainingHope} />
        <HopeItem label="心配なこと" value={draft.personHope.concerns} />
        <HopeItem label="できるようになりたいこと" value={draft.personHope.desiredChanges} />
      </aside>
      <div className="panel">
        {selectedDomains.length > 0 && (
          <div className="selected-domain-bar">
            <strong>選択中</strong>
            <div className="button-row">
              {selectedDomains.map((domain) => <span className="chip selected" key={domain.id}>{domain.label}</span>)}
            </div>
          </div>
        )}
        <div className="choice-grid domains">
          {domains.map((domain) => (
            <label className={selected.has(domain.id) ? "choice selected-choice" : "choice"} key={domain.id}>
              <input type="checkbox" checked={selected.has(domain.id)} onChange={() => toggleDomain(domain.id)} />
              <span><strong>{domain.label}</strong><small>{domain.description}</small></span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function HopeItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="hope-item">
      <strong>{label}</strong>
      <p>{value || "未入力"}</p>
    </div>
  );
}

function StepVocabularySelect({ dictionary, blocks, activeBlock, setActiveBlockId, setSelection, updateBlock, duplicateBlock, removeBlock, onCopied }: {
  dictionary: SupportPlanDictionary;
  blocks: PlanBlock[];
  activeBlock: PlanBlock;
  setActiveBlockId: (id: string) => void;
  setSelection: (id: string, patch: Partial<PlanBlock>) => void;
  updateBlock: (id: string, patch: Partial<PlanBlock>) => void;
  duplicateBlock: (block: PlanBlock) => void;
  removeBlock: (id: string) => void;
  onCopied: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const byDomain = <T extends { domainIds: string[]; label: string }>(items: T[]) => items.filter((item) => item.domainIds.includes(activeBlock.domainId) && item.label.includes(query));
    return {
      directions: byDomain(dictionary.directions),
      situations: byDomain(dictionary.situations),
      actions: byDomain(dictionary.actions),
      supports: byDomain(dictionary.staffSupports),
    };
  }, [activeBlock.domainId, dictionary, query]);

  const ideaRules = useMemo(
    () => suggestIdeas(dictionary.generationRules, activeBlock.triggerIds, activeBlock.actNoticeIds),
    [dictionary.generationRules, activeBlock.triggerIds, activeBlock.actNoticeIds],
  );

  function toggleId(field: "triggerIds" | "actNoticeIds", id: string) {
    if (!id) return;
    const currentIds = activeBlock[field];
    const nextIds = currentIds.includes(id) ? currentIds.filter((value) => value !== id) : [...currentIds, id];
    updateBlock(activeBlock.id, field === "triggerIds" ? { triggerIds: nextIds } : { actNoticeIds: nextIds });
  }

  function clearClues() {
    updateBlock(activeBlock.id, { triggerIds: [], actNoticeIds: [] });
  }

  function applySuggestion(rule: GenerationRule) {
    const action = findSuggestedAction(dictionary, activeBlock.domainId, rule);
    const support = findSuggestedSupport(dictionary, activeBlock.domainId, rule);
    const patch: Partial<PlanBlock> = {};
    if (action) patch.actionId = action.id;
    if (support) patch.staffSupportId = support.id;
    if (!Object.keys(patch).length) return;
    setSelection(activeBlock.id, patch);
  }

  return (
    <div className="vocab-layout">
      <div className="panel vocab-panel">
        <div className="button-row">
          {blocks.map((block, index) => (
            <button key={block.id} className={block.id === activeBlock.id ? "chip selected" : "chip"} onClick={() => setActiveBlockId(block.id)}>
              {index + 1}. {dictionary.domains.find((item) => item.id === block.domainId)?.label ?? "領域"}
            </button>
          ))}
        </div>
        <div className="button-row">
          <button onClick={() => duplicateBlock(activeBlock)}>ブロック複製</button>
          <button className="danger" onClick={() => removeBlock(activeBlock.id)}>ブロック削除</button>
        </div>
        <label>検索<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="語句で絞り込み" /></label>
        <label>支援領域<select value={activeBlock.domainId} onChange={(event) => setSelection(activeBlock.id, { domainId: event.target.value })}>{dictionary.domains.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>

        <details className="idea-box" open>
          <summary>支援アイデアの材料を選ぶ</summary>
          <p className="muted">先行条件とACT通知は、支援候補を出すための補助項目です。計画文にはそのまま入りません。</p>
          <MultiSelect
            label="先行条件"
            placeholder="先行条件を追加"
            items={dictionary.triggers}
            selectedIds={activeBlock.triggerIds}
            onToggle={(id) => toggleId("triggerIds", id)}
          />
          <MultiSelect
            label="ACT通知"
            placeholder="ACT通知を追加"
            items={dictionary.actNotices}
            selectedIds={activeBlock.actNoticeIds}
            onToggle={(id) => toggleId("actNoticeIds", id)}
          />
          {(activeBlock.triggerIds.length > 0 || activeBlock.actNoticeIds.length > 0) && (
            <button type="button" onClick={clearClues}>材料をクリア</button>
          )}
          <SuggestionList
            rules={ideaRules}
            dictionary={dictionary}
            activeDomainId={activeBlock.domainId}
            onApply={applySuggestion}
          />
        </details>

        <Select label="方向性" value={activeBlock.directionId} items={filtered.directions} onChange={(id) => setSelection(activeBlock.id, { directionId: id })} />
        <Select label="場面" value={activeBlock.situationId} items={filtered.situations} onChange={(id) => setSelection(activeBlock.id, { situationId: id })} />
        <Select label="行動" value={activeBlock.actionId} items={filtered.actions} onChange={(id) => setSelection(activeBlock.id, { actionId: id })} />
        <Select label="職員支援" value={activeBlock.staffSupportId} items={filtered.supports} onChange={(id) => setSelection(activeBlock.id, { staffSupportId: id })} />
      </div>
      <ConnectedPreview block={activeBlock} updateBlock={updateBlock} onCopied={onCopied} />
    </div>
  );
}

function Select<T extends { id: string; label: string }>({ label, value, items, onChange }: { label: string; value?: string; items: T[]; onChange: (id: string) => void }) {
  return (
    <label>{label}
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">選択してください</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
  );
}

function MultiSelect<T extends TriggerEntry | ActNoticeEntry>({ label, placeholder, items, selectedIds, onToggle }: {
  label: string;
  placeholder: string;
  items: T[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const selectedItems = selectedIds.map((id) => items.find((item) => item.id === id)).filter(Boolean) as T[];
  const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean)));

  return (
    <div className="multi-select-block">
      <label>{label}
        <select value="" onChange={(event) => onToggle(event.target.value)}>
          <option value="">{placeholder}</option>
          {categories.map((category) => (
            <optgroup key={category} label={category}>
              {items.filter((item) => item.category === category).map((item) => (
                <option key={item.id} value={item.id}>{selectedIds.includes(item.id) ? "✓ " : ""}{item.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {selectedItems.length > 0 && (
        <div className="selected-chip-row" aria-label={label + "の選択中"}>
          {selectedItems.map((item) => (
            <button type="button" className="chip selected removable-chip" key={item.id} onClick={() => onToggle(item.id)}>
              {item.label}<span aria-hidden="true"> ×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionList({ rules, dictionary, activeDomainId, onApply }: {
  rules: GenerationRule[];
  dictionary: SupportPlanDictionary;
  activeDomainId: string;
  onApply: (rule: GenerationRule) => void;
}) {
  if (!rules.length) {
    return <div className="idea-empty">材料を選ぶと、近い支援候補が表示されます。</div>;
  }

  return (
    <div className="idea-list" aria-label="支援アイデア候補">
      <h3>支援候補</h3>
      {rules.map((rule) => {
        const action = findSuggestedAction(dictionary, activeDomainId, rule);
        const support = findSuggestedSupport(dictionary, activeDomainId, rule);
        const canApply = Boolean(action || support);
        return (
          <article className="idea-card" key={rule.id}>
            <div>
              <strong>{rule.suggestedShortGoal || "支援アイデア"}</strong>
              <p>{rule.suggestedSupportOperation || rule.description || "近い語彙候補を確認してください。"}</p>
              <small>
                {action ? "行動候補：" + action.label : "行動候補：該当なし"} / {support ? "職員支援候補：" + support.label : "職員支援候補：該当なし"}
              </small>
            </div>
            <button type="button" disabled={!canApply} onClick={() => onApply(rule)}>候補を反映</button>
          </article>
        );
      })}
    </div>
  );
}

function findSuggestedAction(dictionary: SupportPlanDictionary, domainId: string, rule: GenerationRule) {
  const byIds = dictionary.actions.find((item) => item.domainIds.includes(domainId) && rule.suggestedActionIds?.includes(item.id));
  if (byIds) return byIds;
  const shortGoal = rule.suggestedShortGoal?.trim();
  if (!shortGoal) return undefined;
  return dictionary.actions.find((item) => item.domainIds.includes(domainId) && (item.shortGoal === shortGoal || item.label.includes(shortGoal) || shortGoal.includes(item.label)));
}

function findSuggestedSupport(dictionary: SupportPlanDictionary, domainId: string, rule: GenerationRule): StaffSupportEntry | undefined {
  const byIds = dictionary.staffSupports.find((item) => item.domainIds.includes(domainId) && rule.suggestedSupportIds?.includes(item.id));
  if (byIds) return byIds;
  const operation = rule.suggestedSupportOperation?.trim();
  if (!operation) return undefined;
  return dictionary.staffSupports.find((item) => item.domainIds.includes(domainId) && supportMatches(item, operation));
}

function supportMatches(support: StaffSupportEntry, operation: string): boolean {
  const candidates = [support.label, support.lead, support.sentence].filter(Boolean) as string[];
  return candidates.some((candidate) => {
    if (candidate.includes(operation) || operation.includes(candidate.replace(/し$/, "する")) || operation.includes(candidate)) return true;
    const tokens = keywordTokens(operation);
    if (!tokens.length) return false;
    const matched = tokens.filter((token) => candidate.includes(token)).length;
    return matched >= Math.min(2, tokens.length);
  });
}

function keywordTokens(text: string): string[] {
  return text
    .replace(/[、。・（）()]/g, " ")
    .split(/\s+|を|が|は|に|へ|と|で|の|や|から|まで|等|など|一緒|本人|職員|支援|します|する|し|行う|用意|示す|確認|調整|決める|練習|提示|分ける/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function ConnectedPreview({ block, updateBlock, onCopied }: { block: PlanBlock; updateBlock: (id: string, patch: Partial<PlanBlock>) => void; onCopied: () => void }) {
  return (
    <section className="preview-panel">
      <h2>文章プレビュー</h2>
      <div className="connected-preview">
        <p>{block.directionText || "方向性を選ぶと文が入ります。"}</p>
        <p>{block.actionText || "場面と行動を選ぶと文が入ります。"}</p>
        <p>{block.staffSupportText || "職員支援を選ぶと文が入ります。"}</p>
      </div>
      <div className="adjust-fields" aria-label="文章を調整">
        <label>
          方向性文を調整
          <textarea value={block.directionText} onChange={(event) => updateBlock(block.id, { directionText: event.target.value })} />
        </label>
        <label>
          行動文を調整
          <textarea value={block.actionText} onChange={(event) => updateBlock(block.id, { actionText: event.target.value })} />
        </label>
        <label>
          職員支援文を調整
          <textarea value={block.staffSupportText} onChange={(event) => updateBlock(block.id, { staffSupportText: event.target.value })} />
        </label>
      </div>
      <QualityWarnings warnings={block.qualityWarnings} />
      <CopyButtons block={block} onCopied={onCopied} />
    </section>
  );
}

function ConfirmStep({ blocks, onCopied }: { blocks: PlanBlock[]; onCopied: () => void }) {
  if (!blocks.length) {
    return <div className="panel">支援領域を選択すると、ここに3文確認が表示されます。</div>;
  }
  return (
    <div className="stack confirm-stack">
      {blocks.map((block, index) => (
        <div key={block.id}>
          <h2>計画ブロック {index + 1}</h2>
          <PlanPreview block={block} onCopied={onCopied} />
        </div>
      ))}
    </div>
  );
}

function OutputStep({ draft, complete, onCopied }: { draft: SupportPlanDraft; complete: () => void; onCopied: () => void }) {
  return (
    <div className="stack">
      <div className="panel no-print">
        <h2>保存・出力</h2>
        <CopyButtons plan={draft} onCopied={onCopied} />
        <div className="button-row">
          <button onClick={() => window.print()}>印刷表示</button>
          <button className="primary" onClick={complete}>保存して詳細へ</button>
        </div>
      </div>
      <section className="print-document simple-plan-output">
        <h2>個別支援計画 文案</h2>
        <p><strong>利用者表示名</strong> {draft.clientInfo.displayName || "未入力"}</p>
        <p><strong>計画期間</strong> {draft.clientInfo.planStartDate || ""} - {draft.clientInfo.planEndDate || ""}</p>
        <p><strong>担当職員</strong> {draft.clientInfo.staffName || ""}</p>
        <section>
          <h3>本人の希望</h3>
          <p>{[draft.personHope.originalWords, draft.personHope.workHope, draft.personHope.trainingHope, draft.personHope.concerns, draft.personHope.desiredChanges].filter(Boolean).join("\n")}</p>
        </section>
        {draft.blocks.map((block, index) => (
          <article className="print-block" key={block.id}>
            <h3>支援計画 {index + 1}</h3>
            <p>{block.directionText}</p>
            <p>{block.actionText}</p>
            <p>{block.staffSupportText}</p>
          </article>
        ))}
        {!draft.blocks.length && <p>支援領域と語彙を選択すると、計画の中身が表示されます。</p>}
      </section>
    </div>
  );
}

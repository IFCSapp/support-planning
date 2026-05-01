import { useEffect, useMemo, useState } from "react";
import type { ActNoticeEntry, GenerationRule, StaffSupportEntry, SupportPlanDictionary, TriggerEntry } from "../types/dictionary";
import type { InterviewPurpose, PersonHope, PlanBlock, SupportPlanDraft } from "../types/plan";
import { generateActionText, generateDirectionText, generateStaffSupportText } from "../logic/generateTexts";
import { suggestIdeas } from "../logic/suggestIdeas";
import { validatePlanBlock } from "../logic/validatePlan";
import { getPlan, savePlan } from "../storage/db";
import { createId } from "../utils/id";
import { planEndDateFromMonths, todayString } from "../utils/date";
import PlanPreview from "./PlanPreview";
import CopyButtons from "./CopyButtons";
import QualityWarnings from "./QualityWarnings";
import type { WorkflowHeader } from "./Layout";

const steps = ["基本情報", "本人の希望", "語彙選択", "3文確認", "保存・出力"];

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
  onHeaderChange?: (header: WorkflowHeader | null) => void;
};

export default function PlanWizard({ dictionary, editId, onNavigate, onCopied, onHeaderChange }: Props) {
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"未保存" | "保存中" | "保存済み" | "保存エラー">("未保存");
  const [activeBlockId, setActiveBlockId] = useState("");
  const [draft, setDraft] = useState<SupportPlanDraft>(() => createDraft(dictionary.version));
  const [selectedPlanMonths, setSelectedPlanMonths] = useState<1 | 3 | null>(null);
  const [vocabularyNewBlockIds, setVocabularyNewBlockIds] = useState<string[]>([]);

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

  useEffect(() => {
    onHeaderChange?.({
      title: steps[step],
      status: `${editId ? "計画編集" : "新規計画作成"} / ${saveState}`,
      steps,
      currentStep: step,
      onStepChange: setStep,
    });
    return () => onHeaderChange?.(null);
  }, [editId, onHeaderChange, saveState, step]);

  useEffect(() => {
    if (step !== 2 || draft.blocks.length) return;
    const block = createBlock("");
    changeDraft((current) => ({ ...current, blocks: [block] }));
    setVocabularyNewBlockIds((ids) => [...ids, block.id]);
    setActiveBlockId(block.id);
  }, [draft.blocks.length, step]);

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

  function removeBlock(blockId: string) {
    const next = draft.blocks.filter((block) => block.id !== blockId);
    updateDraft({ blocks: next });
    setActiveBlockId(next[0]?.id ?? "");
    setVocabularyNewBlockIds((ids) => ids.filter((id) => id !== blockId));
  }

  function addVocabularyBlock() {
    const block = createBlock("");
    updateDraft({ blocks: [...draft.blocks, block] });
    setVocabularyNewBlockIds((ids) => [...ids, block.id]);
    setActiveBlockId(block.id);
  }

  async function complete() {
    const completed = { ...draft, status: "completed" as const, updatedAt: new Date().toISOString() };
    await savePlan(completed);
    setDirty(false);
    setSaveState("保存済み");
    onNavigate(`/plans/${completed.id}`);
  }

  return (
    <section className="page wizard-page">
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

      <div className="wizard-actions top-actions no-print">
        <button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>戻る</button>
        {step < steps.length - 1 ? (
          <button className="primary" onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>次へ</button>
        ) : (
          <button className="primary" onClick={complete}>保存して完了</button>
        )}
      </div>

      {step === 0 && (
        <div className="stack">
          <StepPurpose draft={draft} updateDraft={updateDraft} />
          <StepClientInfo draft={draft} selectedPlanMonths={selectedPlanMonths} setSelectedPlanMonths={setSelectedPlanMonths} updateDraft={updateDraft} />
        </div>
      )}
      {step === 1 && <StepPersonHope draft={draft} updateDraft={updateDraft} />}
      {step === 2 && activeBlock && (
        <StepVocabularySelect dictionary={dictionary} personHope={draft.personHope} blocks={draft.blocks} activeBlock={activeBlock} vocabularyNewBlockIds={vocabularyNewBlockIds} setActiveBlockId={setActiveBlockId} setSelection={setSelection} updateBlock={updateBlock} addVocabularyBlock={addVocabularyBlock} removeBlock={removeBlock} onCopied={onCopied} />
      )}
      {step === 3 && <ConfirmStep blocks={draft.blocks} onCopied={onCopied} />}
      {step === 4 && <OutputStep draft={draft} complete={complete} onCopied={onCopied} />}

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

function StepClientInfo({ draft, selectedPlanMonths, setSelectedPlanMonths, updateDraft }: {
  draft: SupportPlanDraft;
  selectedPlanMonths: 1 | 3 | null;
  setSelectedPlanMonths: (months: 1 | 3 | null) => void;
  updateDraft: (patch: Partial<SupportPlanDraft>) => void;
}) {
  const info = draft.clientInfo;
  const setPlanMonths = (months: 1 | 3) => {
    if (!info.planStartDate) return;
    setSelectedPlanMonths(months);
    updateDraft({ clientInfo: { ...info, planEndDate: planEndDateFromMonths(info.planStartDate, months) } });
  };
  const changePlanStartDate = (planStartDate: string) => {
    updateDraft({
      clientInfo: {
        ...info,
        planStartDate,
        planEndDate: selectedPlanMonths && planStartDate ? planEndDateFromMonths(planStartDate, selectedPlanMonths) : info.planEndDate,
      },
    });
  };
  const changePlanEndDate = (planEndDate: string) => {
    setSelectedPlanMonths(null);
    updateDraft({ clientInfo: { ...info, planEndDate } });
  };
  return (
    <div className="form-grid panel">
      <p className="muted wide">利用者表示名は、イニシャルや管理番号でも構いません。</p>
      <label>利用者表示名<input value={info.displayName} onChange={(event) => updateDraft({ clientInfo: { ...info, displayName: event.target.value } })} /></label>
      <label>作成日<input type="date" value={draft.createdAt.slice(0, 10)} readOnly /></label>
      <label>計画期間開始日<input type="date" value={info.planStartDate ?? ""} onChange={(event) => changePlanStartDate(event.target.value)} /></label>
      <div className="date-shortcuts" aria-label="計画期間の終了日を設定">
        <span>終了日を自動設定</span>
        <button type="button" className={selectedPlanMonths === 1 ? "selected" : ""} disabled={!info.planStartDate} onClick={() => setPlanMonths(1)}>1か月</button>
        <button type="button" className={selectedPlanMonths === 3 ? "selected" : ""} disabled={!info.planStartDate} onClick={() => setPlanMonths(3)}>3か月</button>
      </div>
      <label>計画期間終了日<input type="date" value={info.planEndDate ?? ""} onChange={(event) => changePlanEndDate(event.target.value)} /></label>
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

function StepVocabularySelect({ dictionary, personHope, blocks, activeBlock, vocabularyNewBlockIds, setActiveBlockId, setSelection, updateBlock, addVocabularyBlock, removeBlock, onCopied }: {
  dictionary: SupportPlanDictionary;
  personHope: PersonHope;
  blocks: PlanBlock[];
  activeBlock: PlanBlock;
  vocabularyNewBlockIds: string[];
  setActiveBlockId: (id: string) => void;
  setSelection: (id: string, patch: Partial<PlanBlock>) => void;
  updateBlock: (id: string, patch: Partial<PlanBlock>) => void;
  addVocabularyBlock: () => void;
  removeBlock: (id: string) => void;
  onCopied: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const byDomain = <T extends { domainIds: string[] }>(items: T[]) => items.filter((item) => item.domainIds.includes(activeBlock.domainId));
    const withSelected = <T extends { id: string }>(items: T[], allItems: T[], selectedId?: string) => {
      const selectedItem = allItems.find((item) => item.id === selectedId);
      return selectedItem && !items.some((item) => item.id === selectedItem.id) ? [selectedItem, ...items] : items;
    };
    return {
      directions: withSelected(byDomain(dictionary.directions), dictionary.directions, activeBlock.directionId),
      situations: withSelected(byDomain(dictionary.situations), dictionary.situations, activeBlock.situationId),
      actions: withSelected(byDomain(dictionary.actions), dictionary.actions, activeBlock.actionId),
      supports: withSelected(byDomain(dictionary.staffSupports), dictionary.staffSupports, activeBlock.staffSupportId),
    };
  }, [activeBlock.domainId, activeBlock.directionId, activeBlock.situationId, activeBlock.actionId, activeBlock.staffSupportId, dictionary]);

  const searchResults = useMemo(() => {
    const keyword = query.trim();
    if (!keyword) return [];
    return [
      ...dictionary.directions.filter((item) => vocabularyItemMatches(item, keyword)).map((item) => ({ field: "directionId" as const, type: "方向性", item })),
      ...dictionary.situations.filter((item) => vocabularyItemMatches(item, keyword)).map((item) => ({ field: "situationId" as const, type: "場面", item })),
      ...dictionary.actions.filter((item) => vocabularyItemMatches(item, keyword)).map((item) => ({ field: "actionId" as const, type: "行動", item })),
      ...dictionary.staffSupports.filter((item) => vocabularyItemMatches(item, keyword)).map((item) => ({ field: "staffSupportId" as const, type: "職員支援", item })),
    ].slice(0, 30);
  }, [dictionary, query]);

  const ideaRules = useMemo(
    () => suggestIdeas(dictionary.generationRules, activeBlock.triggerIds, activeBlock.actNoticeIds, dictionary.triggers, dictionary.actNotices),
    [dictionary.generationRules, dictionary.triggers, dictionary.actNotices, activeBlock.triggerIds, activeBlock.actNoticeIds],
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

  function setVocabularySelection<T extends { id: string; domainIds: string[] }>(field: "directionId" | "situationId" | "actionId" | "staffSupportId", id: string, items: T[]) {
    const selectedItem = items.find((item) => item.id === id);
    const patch: Partial<PlanBlock> = { [field]: id };
    if (selectedItem?.domainIds[0]) patch.domainId = selectedItem.domainIds[0];
    setSelection(activeBlock.id, patch);
    setQuery("");
  }

  function clearVocabularySelection(field: "directionId" | "situationId" | "actionId" | "staffSupportId") {
    const patch: Partial<PlanBlock> = { [field]: undefined };

    if (field === "directionId") {
      patch.directionText = "";
    }

    if (field === "situationId" || field === "actionId") {
      patch.actionText = "";
    }

    if (field === "staffSupportId") {
      patch.staffSupportText = "";
    }

    setSelection(activeBlock.id, patch);
  }

  function clearAllVocabularySelections() {
    setSelection(activeBlock.id, {
      directionId: undefined,
      situationId: undefined,
      actionId: undefined,
      staffSupportId: undefined,
      monitoringId: undefined,
      directionText: "",
      actionText: "",
      staffSupportText: "",
      monitoringText: "",
      shortGoal: "",
    });
  }

  function setIdeaSelection<T extends { id: string; domainIds: string[] }>(field: "actionId" | "staffSupportId", id: string, items: T[]) {
    const selectedItem = items.find((item) => item.id === id);
    const patch: Partial<PlanBlock> = { [field]: id, triggerIds: [], actNoticeIds: [] };
    if (selectedItem?.domainIds[0]) patch.domainId = selectedItem.domainIds[0];
    setSelection(activeBlock.id, patch);
  }

  return (
    <div className="vocab-layout">
      <div className="panel vocab-panel">
        <HopeSummary hope={personHope} />
        <div className="button-row vocab-block-row">
          {blocks.map((block, index) => (
            <span key={block.id} className={block.id === activeBlock.id ? "vocab-block-chip selected" : "vocab-block-chip"}>
              <button type="button" className="vocab-block-main" onClick={() => setActiveBlockId(block.id)}>
                {index + 1}. {dictionary.domains.find((item) => item.id === block.domainId)?.label ?? "支援領域未選択"}
              </button>
              <button type="button" className="vocab-block-delete" aria-label="ブロックを削除" onClick={() => removeBlock(block.id)}>×</button>
            </span>
          ))}
          <button type="button" className="chip add-block" onClick={addVocabularyBlock}>＋</button>
        </div>
        <label>検索<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="すべての領域から検索" /></label>
        {query.trim() && (
          <>
            <p className="muted search-result-count">
              検索結果 {searchResults.length}件
            </p>
            <div className="search-results" aria-label="検索結果">
              {searchResults.length > 0 ? searchResults.map(({ field, type, item }) => (
                <button type="button" key={`${field}-${item.id}`} onClick={() => setVocabularySelection(field, item.id, [item])}>
                  <span>{type}</span>
                  <strong>{item.label}</strong>
                  <small>{item.domainIds.map((id) => dictionary.domains.find((domain) => domain.id === id)?.label ?? id).join(" / ")}</small>
                </button>
              )) : <p>該当する語彙がありません。</p>}
            </div>
          </>
        )}

        <details className="idea-box">
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
            onSelectAction={(id) => setIdeaSelection("actionId", id, dictionary.actions)}
            onSelectSupport={(id) => setIdeaSelection("staffSupportId", id, dictionary.staffSupports)}
          />
        </details>

        <div className="vocabulary-control-row">
          <label className="vocabulary-domain-select">
            支援領域
            <select
              value={activeBlock.domainId}
              onChange={(event) => setSelection(activeBlock.id, { domainId: event.target.value })}
            >
              <option value="">選択してください</option>
              {dictionary.domains.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="danger vocabulary-clear-all"
            onClick={() => {
              if (!confirm("このブロックの選択済み項目をすべてクリアしますか？")) return;
              clearAllVocabularySelections();
            }}
          >
            選択済み項目をすべてクリア
          </button>
        </div>

        <Select
          label="方向性"
          value={activeBlock.directionId}
          items={filtered.directions}
          onChange={(id) => setVocabularySelection("directionId", id, dictionary.directions)}
          onClear={() => clearVocabularySelection("directionId")}
          highlightWhenEmpty
        />

        <Select
          label="場面"
          value={activeBlock.situationId}
          items={filtered.situations}
          onChange={(id) => setVocabularySelection("situationId", id, dictionary.situations)}
          onClear={() => clearVocabularySelection("situationId")}
          highlightWhenEmpty
        />

        <Select
          label="行動"
          value={activeBlock.actionId}
          items={filtered.actions}
          onChange={(id) => setVocabularySelection("actionId", id, dictionary.actions)}
          onClear={() => clearVocabularySelection("actionId")}
          highlightWhenEmpty
        />

        <Select
          label="職員支援"
          value={activeBlock.staffSupportId}
          items={filtered.supports}
          onChange={(id) => setVocabularySelection("staffSupportId", id, dictionary.staffSupports)}
          onClear={() => clearVocabularySelection("staffSupportId")}
          highlightWhenEmpty
        />
      </div>
      <ConnectedPreview
        block={activeBlock}
        dictionary={dictionary}
        updateBlock={updateBlock}
        onCopied={onCopied}
      />
    </div>
  );
}

function HopeSummary({ hope }: { hope: PersonHope }) {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const items = [
    ["本人の言葉", hope.originalWords],
    ["働き方", hope.workHope],
    ["通所・訓練", hope.trainingHope],
    ["心配なこと", hope.concerns],
    ["できるようになりたいこと", hope.desiredChanges],
  ].filter((item): item is [string, string] => Boolean(item[1]?.trim()));

  const toggleExpanded = (label: string) => {
    setExpandedKeys((keys) =>
      keys.includes(label) ? keys.filter((key) => key !== label) : [...keys, label],
    );
  };

  return (
    <details className="hope-summary-box">
      <summary>本人の希望</summary>
      {items.length > 0 ? (
        <div className="hope-summary-items">
          {items.map(([label, value]) => {
            const expanded = expandedKeys.includes(label);
            return (
              <span key={label} className={expanded ? "expanded" : ""}>
                <b>{label}</b>{value}
                <button type="button" className="hope-toggle" onClick={() => toggleExpanded(label)}>
                  {expanded ? "閉じる" : "展開"}
                </button>
              </span>
            );
          })}
        </div>
      ) : (
        <p>未入力</p>
      )}
    </details>
  );
}

function Select<T extends { id: string; label: string }>({
  label,
  value,
  items,
  onChange,
  onClear,
  highlightWhenEmpty = false,
}: {
  label: string;
  value?: string;
  items: T[];
  onChange: (id: string) => void;
  onClear?: () => void;
  highlightWhenEmpty?: boolean;
}) {
  const needsSelection = highlightWhenEmpty && !value;

  return (
    <div className={needsSelection ? "select-field needs-selection" : "select-field"}>
      <div className="select-field-header">
        <strong>{label}</strong>
        {value && onClear && (
          <button type="button" className="mini-clear-button" onClick={onClear}>
            クリア
          </button>
        )}
      </div>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">選択してください</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function vocabularyItemMatches(item: { label: string; tags?: string[]; sentence?: string; shortGoal?: string; lead?: string }, keyword: string): boolean {
  return [item.label, item.sentence, item.shortGoal, item.lead, ...(item.tags ?? [])].filter(Boolean).some((value) => value?.includes(keyword));
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

function SuggestionList({ rules, dictionary, activeDomainId, onSelectAction, onSelectSupport }: {
  rules: GenerationRule[];
  dictionary: SupportPlanDictionary;
  activeDomainId: string;
  onSelectAction: (id: string) => void;
  onSelectSupport: (id: string) => void;
}) {
  if (!rules.length) {
    return <div className="idea-empty">材料を選ぶと、近い支援候補が表示されます。</div>;
  }

  return (
    <div className="idea-list" aria-label="支援アイデア候補">
      <h3>支援アイデア</h3>
      {rules.map((rule) => {
        const action = findSuggestedAction(dictionary, activeDomainId, rule);
        const support = findSuggestedSupport(dictionary, activeDomainId, rule);
        return (
          <article className="idea-card" key={rule.id}>
            <div className="idea-card-summary">
              <strong>{rule.suggestedShortGoal || "支援アイデア"}</strong>
              <p>{rule.suggestedSupportOperation || rule.description || "近い語彙候補を確認してください。"}</p>
            </div>
            <div className="idea-picks">
              {action && (
                <button type="button" onClick={() => onSelectAction(action.id)}>
                  <span>行動</span>
                  <strong>{action.label}</strong>
                  <small>{action.domainIds.map((id) => dictionary.domains.find((domain) => domain.id === id)?.label ?? id).join(" / ")}</small>
                </button>
              )}
              {support && (
                <button type="button" onClick={() => onSelectSupport(support.id)}>
                  <span>職員支援</span>
                  <strong>{support.label}</strong>
                  <small>{support.domainIds.map((id) => dictionary.domains.find((domain) => domain.id === id)?.label ?? id).join(" / ")}</small>
                </button>
              )}
              {!action && !support && <p>選択できる語彙候補がありません。</p>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function findSuggestedAction(dictionary: SupportPlanDictionary, domainId: string, rule: GenerationRule) {
  const byIds = findPreferredByDomain(dictionary.actions, domainId, (item) => rule.suggestedActionIds?.includes(item.id) ?? false);
  if (byIds) return byIds;
  const shortGoal = rule.suggestedShortGoal?.trim();
  if (!shortGoal) return undefined;
  return findPreferredByDomain(dictionary.actions, domainId, (item) => item.shortGoal === shortGoal || item.label.includes(shortGoal) || shortGoal.includes(item.label));
}

function findSuggestedSupport(dictionary: SupportPlanDictionary, domainId: string, rule: GenerationRule): StaffSupportEntry | undefined {
  const byIds = findPreferredByDomain(dictionary.staffSupports, domainId, (item) => rule.suggestedSupportIds?.includes(item.id) ?? false);
  if (byIds) return byIds;
  const operations = [rule.suggestedSupportOperation, ...(rule.triggerLabels ?? []), ...(rule.actNoticeLabels ?? []), rule.description]
    .map((text) => text?.trim())
    .filter(Boolean) as string[];
  if (!operations.length) return undefined;

  const rankedSupports = dictionary.staffSupports
    .map((support) => ({
      support,
      score: operations.reduce((total, operation) => total + supportMatchScore(support, operation), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      const domainDiff = Number(b.support.domainIds.includes(domainId)) - Number(a.support.domainIds.includes(domainId));
      if (domainDiff) return domainDiff;
      return b.score - a.score;
    });

  return rankedSupports[0]?.support ?? dictionary.staffSupports.find((support) => support.domainIds.includes(domainId)) ?? dictionary.staffSupports[0];
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

function supportMatchScore(support: StaffSupportEntry, operation: string): number {
  return supportMatches(support, operation) ? 1 : 0;
}

function findPreferredByDomain<T extends { domainIds: string[] }>(items: T[], domainId: string, predicate: (item: T) => boolean): T | undefined {
  return items.find((item) => item.domainIds.includes(domainId) && predicate(item)) ?? items.find(predicate);
}

function keywordTokens(text: string): string[] {
  return text
    .replace(/[、。・（）()]/g, " ")
    .split(/\s+|を|が|は|に|へ|と|で|の|や|から|まで|等|など|一緒|本人|職員|支援|します|する|し|行う|用意|示す|確認|調整|決める|練習|提示|分ける/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function ConnectedPreview({
  block,
  dictionary,
  updateBlock,
  onCopied,
}: {
  block: PlanBlock;
  dictionary: SupportPlanDictionary;
  updateBlock: (id: string, patch: Partial<PlanBlock>) => void;
  onCopied: () => void;
}) {
  const selectedDirection = dictionary.directions.find((item) => item.id === block.directionId);
  const selectedSituation = dictionary.situations.find((item) => item.id === block.situationId);
  const selectedAction = dictionary.actions.find((item) => item.id === block.actionId);
  const selectedSupport = dictionary.staffSupports.find((item) => item.id === block.staffSupportId);
  const selectedDomain = dictionary.domains.find((item) => item.id === block.domainId);
  return (
    <section className="preview-panel">
      <section className={selectedDomain ? "selected-domain-preview filled" : "selected-domain-preview"}>
        <span>選択済み支援領域</span>
        <strong>{selectedDomain?.label ?? "未選択"}</strong>
        {selectedDomain?.description && <p>{selectedDomain.description}</p>}
      </section>
      <h2>文章プレビュー</h2>
      <div className="selected-vocabulary-summary" aria-label="選択済み語彙">
        <strong>選択済み</strong>
        <dl>
          <div className={selectedDirection ? "filled" : ""}>
            <dt>方向性</dt>
            <dd>{selectedDirection?.label ?? "未選択"}</dd>
          </div>
          <div className={selectedSituation ? "filled" : ""}>
            <dt>場面</dt>
            <dd>{selectedSituation?.label ?? "未選択"}</dd>
          </div>
          <div className={selectedAction ? "filled" : ""}>
            <dt>行動</dt>
            <dd>{selectedAction?.label ?? "未選択"}</dd>
          </div>
          <div className={selectedSupport ? "filled" : ""}>
            <dt>職員支援</dt>
            <dd>{selectedSupport?.label ?? "未選択"}</dd>
          </div>
        </dl>
      </div>
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

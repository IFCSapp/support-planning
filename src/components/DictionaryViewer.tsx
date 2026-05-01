import { useMemo, useRef, useState } from "react";
import type {
  ActionEntry,
  ActNoticeEntry,
  DirectionEntry,
  GenerationRule,
  SituationEntry,
  StaffSupportEntry,
  SupportDomain,
  SupportPlanDictionary,
  TriggerEntry,
} from "../types/dictionary";
import { normalizeDictionary } from "../data/dictionaryLoader";
import { generateActionText, generateDirectionText, generateStaffSupportText } from "../logic/generateTexts";

type TabKey = "domains" | "directions" | "situations" | "actions" | "staffSupports" | "triggers" | "actNotices" | "generationRules";
type EditableEntry = { id: string; label?: string; description?: string };
type DictionaryChangeLog = { at: string; category: string; id: string; before: unknown; after: unknown };
type DictionaryIssue = { level: "error" | "warning"; message: string };

type Props = {
  dictionary: SupportPlanDictionary;
  standardDictionary: SupportPlanDictionary;
  onChange: (dictionary: SupportPlanDictionary) => void;
  onReset: () => void;
  onUpdateToStandard: () => void;
};

const CHANGE_LOG_KEY = "support-plan-navi-dictionary-change-log";

const tabs: Array<[TabKey, string]> = [
  ["domains", "支援領域"],
  ["directions", "方向性"],
  ["situations", "場面"],
  ["actions", "行動"],
  ["staffSupports", "職員支援"],
  ["triggers", "先行条件"],
  ["actNotices", "ACT通知"],
  ["generationRules", "支援候補ルール"],
];

export default function DictionaryViewer({
  dictionary,
  standardDictionary,
  onChange,
  onReset,
  onUpdateToStandard,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("domains");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [issues, setIssues] = useState<DictionaryIssue[]>([]);
  const [changeLog, setChangeLog] = useState<DictionaryChangeLog[]>(() => loadChangeLog());
  const hasStandardDictionaryUpdate = dictionary.version !== standardDictionary.version;

  const items = useMemo(() => {
    const source = dictionary[activeTab] as EditableEntry[];
    const keyword = query.trim();
    if (!keyword) return source;
    return source.filter((item) => [item.id, item.label, item.description].filter(Boolean).some((value) => value?.includes(keyword)));
  }, [activeTab, dictionary, query]);

  function commit(nextDictionary: SupportPlanDictionary, category: string, id: string, before: unknown, after: unknown) {
    onChange(nextDictionary);
    const nextLog = [{ at: new Date().toISOString(), category, id, before, after }, ...changeLog].slice(0, 100);
    setChangeLog(nextLog);
    localStorage.setItem(CHANGE_LOG_KEY, JSON.stringify(nextLog));
  }

  function updateCollection<T extends { id: string }>(key: TabKey, id: string, patch: Partial<T>) {
    const before = (dictionary[key] as T[]).find((item) => item.id === id);
    const nextItems = (dictionary[key] as T[]).map((item) => item.id === id ? { ...item, ...patch } : item);
    const after = nextItems.find((item) => item.id === id);
    commit({ ...dictionary, [key]: nextItems }, key, id, before, after);
  }

  function addEntry() {
    const id = `${activeTab}_${Date.now()}`;
    const firstDomainId = dictionary.domains[0]?.id ?? "";
    const next = createEntry(activeTab, id, firstDomainId);
    commit({ ...dictionary, [activeTab]: [...(dictionary[activeTab] as unknown[]), next] }, activeTab, id, null, next);
    setQuery("");
  }

  function removeEntry(id: string) {
    const before = (dictionary[activeTab] as EditableEntry[]).find((item) => item.id === id);
    commit({ ...dictionary, [activeTab]: (dictionary[activeTab] as EditableEntry[]).filter((item) => item.id !== id) }, activeTab, id, before, null);
  }

  function exportDictionary() {
    const blob = new Blob([JSON.stringify(dictionary, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `support-plan-dictionary-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("辞書JSONを書き出しました。");
  }

  async function importDictionary(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const nextDictionary = normalizeImportedDictionary(parsed, dictionary);
      commit(nextDictionary, "dictionary", "import", dictionary, nextDictionary);
      setMessage("辞書JSONを読み込みました。");
    } catch {
      setMessage("辞書JSONを読み込めませんでした。");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function resetToStandard() {
    onReset();
    const nextLog = [{ at: new Date().toISOString(), category: "dictionary", id: "reset-standard", before: dictionary, after: standardDictionary }, ...changeLog].slice(0, 100);
    setChangeLog(nextLog);
    localStorage.setItem(CHANGE_LOG_KEY, JSON.stringify(nextLog));
    setMessage("標準辞書に戻しました。");
  }

  function runDictionaryCheck() {
    const nextIssues = checkDictionary(dictionary);
    setIssues(nextIssues);
    setMessage(nextIssues.length ? `${nextIssues.length}件の確認項目があります。` : "辞書チェックで問題は見つかりませんでした。");
  }

  return (
    <section className="page">
      <div className="page-heading">
        <p className="eyebrow">辞書バージョン {dictionary.version}</p>
        <h1>辞書編集</h1>
        <p className="muted">語彙ごとに、自然な文を作るための語尾や接続を編集できます。支援アイデア候補用のルールも別タブで編集できます。</p>
      </div>
      <div className="summary-grid">
        <span>領域 {dictionary.domains.length}</span>
        <span>語彙 {dictionary.directions.length + dictionary.situations.length + dictionary.actions.length + dictionary.staffSupports.length}</span>
        <span>材料 {dictionary.triggers.length + dictionary.actNotices.length}</span>
        <span>支援候補ルール {dictionary.generationRules.length}</span>
      </div>
      {hasStandardDictionaryUpdate && (
        <section className="panel dictionary-check">
           <h2>標準辞書が更新されています</h2>
           <p className="muted">
             現在の辞書バージョンは {dictionary.version} です。標準辞書バージョン {standardDictionary.version} を取り込めます。
             取り込む前に、現在の編集済み辞書は端末内にバックアップされます。
           </p>
           <div className="button-row">
             <button
               type="button"
               className="primary"
               onClick={() => {
                 if (!confirm("現在の編集済み辞書をバックアップして、標準辞書を反映しますか？")) return;
                 onUpdateToStandard();
                 setMessage("標準辞書を反映しました。以前の辞書は端末内にバックアップされています。");
               }}
              >
                標準辞書を反映する
             </button>
           </div>
        </section>
     )}

      <div className="panel dictionary-actions">
        <div className="button-row">
          <button className="primary" type="button" onClick={addEntry}>現在のタブに追加</button>
          <button type="button" onClick={resetToStandard}>編集を破棄して標準辞書に戻す</button>
          <button type="button" onClick={exportDictionary}>編集済み辞書を書き出す</button>
          <button type="button" onClick={() => fileRef.current?.click()}>編集済み辞書を読み込む</button>
          <button type="button" onClick={runDictionaryCheck}>辞書チェックを実行する</button>
          <input ref={fileRef} className="hidden" type="file" accept="application/json" onChange={(event) => importDictionary(event.target.files?.[0])} />
        </div>
        {message && <p className="toast-inline">{message}</p>}
      </div>
      {issues.length > 0 && (
        <section className="panel dictionary-check">
          <h2>辞書チェック結果</h2>
          <ul>
            {issues.map((issue, index) => <li key={index} className={issue.level}>{issue.message}</li>)}
          </ul>
        </section>
      )}
      <div className="dictionary-toolbar">
        <div className="tab-row" role="tablist" aria-label="辞書カテゴリ">
          {tabs.map(([key, label]) => (
            <button key={key} className={activeTab === key ? "tab active" : "tab"} onClick={() => setActiveTab(key)} type="button">
              {label}
            </button>
          ))}
        </div>
        <label className="dictionary-search">
          検索
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="語句またはID" />
        </label>
      </div>
      <div className="list">
        {activeTab === "domains" && (items as SupportDomain[]).map((item) => (
          <article className="list-item dictionary-entry" key={item.id}>
            <EntryHeader id={item.id} onRemove={removeEntry} />
            <label>表示名<input value={item.label} onChange={(event) => updateCollection<SupportDomain>("domains", item.id, { label: event.target.value })} /></label>
            <label>説明<textarea value={item.description ?? ""} onChange={(event) => updateCollection<SupportDomain>("domains", item.id, { description: event.target.value })} /></label>
          </article>
        ))}
        {activeTab === "directions" && (items as DirectionEntry[]).map((item) => (
          <VocabularyEditor key={item.id} kind="direction" item={item} dictionary={dictionary} onRemove={removeEntry} onChange={(patch) => updateCollection<DirectionEntry>("directions", item.id, patch)} />
        ))}
        {activeTab === "situations" && (items as SituationEntry[]).map((item) => (
          <VocabularyEditor key={item.id} kind="situation" item={item} dictionary={dictionary} onRemove={removeEntry} onChange={(patch) => updateCollection<SituationEntry>("situations", item.id, patch)} />
        ))}
        {activeTab === "actions" && (items as ActionEntry[]).map((item) => (
          <ActionEditor key={item.id} item={item} dictionary={dictionary} onRemove={removeEntry} onChange={(patch) => updateCollection<ActionEntry>("actions", item.id, patch)} />
        ))}
        {activeTab === "staffSupports" && (items as StaffSupportEntry[]).map((item) => (
          <SupportEditor key={item.id} item={item} dictionary={dictionary} onRemove={removeEntry} onChange={(patch) => updateCollection<StaffSupportEntry>("staffSupports", item.id, patch)} />
        ))}
        {activeTab === "triggers" && (items as TriggerEntry[]).map((item) => (
          <MaterialEditor key={item.id} item={item} onRemove={removeEntry} onChange={(patch) => updateCollection<TriggerEntry>("triggers", item.id, patch)} />
        ))}
        {activeTab === "actNotices" && (items as ActNoticeEntry[]).map((item) => (
          <MaterialEditor key={item.id} item={item} onRemove={removeEntry} onChange={(patch) => updateCollection<ActNoticeEntry>("actNotices", item.id, patch)} />
        ))}
        {activeTab === "generationRules" && (items as GenerationRule[]).map((item) => (
          <RuleEditor key={item.id} item={item} dictionary={dictionary} onRemove={removeEntry} onChange={(patch) => updateCollection<GenerationRule>("generationRules", item.id, patch)} />
        ))}
        {!items.length && <p className="muted">該当する項目はありません。</p>}
      </div>
      <section className="panel dictionary-log">
        <h2>変更ログ</h2>
        {changeLog.length ? (
          <div className="list">
            {changeLog.slice(0, 20).map((entry, index) => (
              <details key={`${entry.at}-${index}`}>
                <summary>{new Date(entry.at).toLocaleString("ja-JP")} / {entry.category} / {entry.id}</summary>
                <pre>{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre>
              </details>
            ))}
          </div>
        ) : <p className="muted">まだ変更はありません。</p>}
      </section>
    </section>
  );
}

function EntryHeader({ id, onRemove }: { id: string; onRemove: (id: string) => void }) {
  return (
    <div className="dictionary-entry-header">
      <small>{id}</small>
      <button type="button" className="danger" onClick={() => onRemove(id)}>削除</button>
    </div>
  );
}

function VocabularyEditor<T extends DirectionEntry | SituationEntry>({ kind, item, dictionary, onChange, onRemove }: {
  kind: "direction" | "situation";
  item: T;
  dictionary: SupportPlanDictionary;
  onChange: (patch: Partial<T>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <article className="list-item dictionary-entry">
      <EntryHeader id={item.id} onRemove={onRemove} />
      <label>ラベル<input value={item.label} onChange={(event) => onChange({ label: event.target.value } as Partial<T>)} /></label>
      <DomainSelector dictionary={dictionary} value={item.domainIds} onChange={(domainIds) => onChange({ domainIds } as Partial<T>)} />
      <label>完成文を直接指定<textarea value={item.sentence ?? ""} onChange={(event) => onChange({ sentence: event.target.value } as Partial<T>)} placeholder="空欄なら下の語尾・接続を使って生成します" /></label>
      {kind === "direction" && <label>方向性の語尾<input value={(item as DirectionEntry).ending ?? "ましょう"} onChange={(event) => onChange(({ ending: event.target.value } as unknown) as Partial<T>)} placeholder="ましょう" /></label>}
      {kind === "situation" && <label>場面と行動をつなぐ語<input value={(item as SituationEntry).sentenceConnector ?? "は"} onChange={(event) => onChange(({ sentenceConnector: event.target.value } as unknown) as Partial<T>)} placeholder="は" /></label>}
      {kind === "direction" && <Preview label="生成文" text={generateDirectionText(item as DirectionEntry)} />}
      {kind === "situation" && <Preview label="接続プレビュー" text={`${item.label}${(item as SituationEntry).sentenceConnector ?? "は"}、質問内容を一文でメモしてみましょう。`} />}
      <label>検索タグ<input value={(item.tags ?? []).join(", ")} onChange={(event) => onChange({ tags: csvToArray(event.target.value) } as Partial<T>)} /></label>
    </article>
  );
}

function ActionEditor({ item, dictionary, onChange, onRemove }: { item: ActionEntry; dictionary: SupportPlanDictionary; onChange: (patch: Partial<ActionEntry>) => void; onRemove: (id: string) => void }) {
  return (
    <article className="list-item dictionary-entry">
      <EntryHeader id={item.id} onRemove={onRemove} />
      <label>ラベル<input value={item.label} onChange={(event) => onChange({ label: event.target.value })} /></label>
      <DomainSelector dictionary={dictionary} value={item.domainIds} onChange={(domainIds) => onChange({ domainIds })} />
      <label>完成文を直接指定<textarea value={item.sentence ?? ""} onChange={(event) => onChange({ sentence: event.target.value })} placeholder="空欄なら下のて形・語尾を使って生成します" /></label>
      <label>短期目標<input value={item.shortGoal ?? ""} onChange={(event) => onChange({ shortGoal: event.target.value })} /></label>
      <label>行動のて形<input value={item.teForm ?? ""} onChange={(event) => onChange({ teForm: event.target.value })} placeholder="例: 手順表を見て" /></label>
      <label>行動文の語尾<input value={item.actionEnding ?? "みましょう"} onChange={(event) => onChange({ actionEnding: event.target.value })} placeholder="みましょう" /></label>
      <Preview label="生成文" text={generateActionText(sampleSituationFor(item, dictionary), item)} />
      <label>検索タグ<input value={(item.tags ?? []).join(", ")} onChange={(event) => onChange({ tags: csvToArray(event.target.value) })} /></label>
    </article>
  );
}

function SupportEditor({ item, dictionary, onChange, onRemove }: { item: StaffSupportEntry; dictionary: SupportPlanDictionary; onChange: (patch: Partial<StaffSupportEntry>) => void; onRemove: (id: string) => void }) {
  return (
    <article className="list-item dictionary-entry">
      <EntryHeader id={item.id} onRemove={onRemove} />
      <label>ラベル<input value={item.label} onChange={(event) => onChange({ label: event.target.value })} /></label>
      <DomainSelector dictionary={dictionary} value={item.domainIds} onChange={(domainIds) => onChange({ domainIds })} />
      <label>完成文を直接指定<textarea value={item.sentence ?? ""} onChange={(event) => onChange({ sentence: event.target.value })} placeholder="空欄なら下の主語・接続・語尾を使って生成します" /></label>
      <label>支援文の主語<input value={item.subject ?? "職員は"} onChange={(event) => onChange({ subject: event.target.value })} placeholder="職員は" /></label>
      <label>支援操作<input value={item.lead ?? ""} onChange={(event) => onChange({ lead: event.target.value })} placeholder="例: 手順表を一緒に確認し" /></label>
      <label>支援操作と語尾の接続<input value={item.connector ?? "、"} onChange={(event) => onChange({ connector: event.target.value })} placeholder="、" /></label>
      <label>支援文の語尾<input value={item.ending ?? ""} onChange={(event) => onChange({ ending: event.target.value })} placeholder="取り組みやすくなるよう支援します" /></label>
      <Preview label="生成文" text={generateStaffSupportText(item)} />
      <label>検索タグ<input value={(item.tags ?? []).join(", ")} onChange={(event) => onChange({ tags: csvToArray(event.target.value) })} /></label>
    </article>
  );
}

function MaterialEditor<T extends TriggerEntry | ActNoticeEntry>({ item, onChange, onRemove }: { item: T; onChange: (patch: Partial<T>) => void; onRemove: (id: string) => void }) {
  return (
    <article className="list-item dictionary-entry">
      <EntryHeader id={item.id} onRemove={onRemove} />
      <label>ラベル<input value={item.label} onChange={(event) => onChange({ label: event.target.value } as Partial<T>)} /></label>
      <label>カテゴリ<input value={item.category} onChange={(event) => onChange({ category: event.target.value } as Partial<T>)} /></label>
      <label>検索タグ<input value={(item.tags ?? []).join(", ")} onChange={(event) => onChange({ tags: csvToArray(event.target.value) } as Partial<T>)} /></label>
    </article>
  );
}

function RuleEditor({ item, dictionary, onChange, onRemove }: { item: GenerationRule; dictionary: SupportPlanDictionary; onChange: (patch: Partial<GenerationRule>) => void; onRemove: (id: string) => void }) {
  return (
    <article className="list-item dictionary-entry">
      <EntryHeader id={item.id} onRemove={onRemove} />
      <label>説明<textarea value={item.description ?? ""} onChange={(event) => onChange({ description: event.target.value })} /></label>
      <MultiIdSelector title="このルールを出す条件: 先行条件" items={dictionary.triggers} selectedIds={item.triggerIds ?? []} onChange={(triggerIds) => onChange({ triggerIds })} />
      <MultiIdSelector title="このルールを出す条件: ACT通知" items={dictionary.actNotices} selectedIds={item.actNoticeIds ?? []} onChange={(actNoticeIds) => onChange({ actNoticeIds })} />
      <MultiIdSelector title="このルールで出す候補: 行動" items={dictionary.actions} selectedIds={item.suggestedActionIds ?? []} onChange={(suggestedActionIds) => onChange({ suggestedActionIds })} />
      <MultiIdSelector title="このルールで出す候補: 職員支援" items={dictionary.staffSupports} selectedIds={item.suggestedSupportIds ?? []} onChange={(suggestedSupportIds) => onChange({ suggestedSupportIds })} />
      <label>短期目標案<input value={item.suggestedShortGoal ?? ""} onChange={(event) => onChange({ suggestedShortGoal: event.target.value })} /></label>
      <label>支援アイデアに表示する説明<textarea value={item.suggestedSupportOperation ?? ""} onChange={(event) => onChange({ suggestedSupportOperation: event.target.value })} /></label>
    </article>
  );
}

function Preview({ label, text }: { label: string; text: string }) {
  return (
    <div className="dictionary-preview">
      <strong>{label}</strong>
      <p>{text || "生成に必要な語彙を入力してください。"}</p>
    </div>
  );
}

function MultiIdSelector<T extends { id: string; label: string }>({ title, items, selectedIds, onChange }: { title: string; items: T[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState("");
  const visibleItems = items.filter((item) => !query.trim() || item.label.includes(query) || item.id.includes(query)).slice(0, 80);
  return (
    <fieldset className="multi-id-selector">
      <legend>{title}</legend>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="検索" />
      <div>
        {visibleItems.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={() => onChange(selectedIds.includes(item.id) ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id])}
            />
            <span>{item.label}</span>
            <small>{item.id}</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DomainSelector({ dictionary, value, onChange }: { dictionary: SupportPlanDictionary; value: string[]; onChange: (domainIds: string[]) => void }) {
  return (
    <fieldset className="domain-selector">
      <legend>所属支援領域</legend>
      {dictionary.domains.map((domain) => (
        <label key={domain.id}>
          <input
            type="checkbox"
            checked={value.includes(domain.id)}
            onChange={() => onChange(value.includes(domain.id) ? value.filter((id) => id !== domain.id) : [...value, domain.id])}
          />
          {domain.label}
        </label>
      ))}
    </fieldset>
  );
}

function createEntry(tab: TabKey, id: string, domainId: string) {
  if (tab === "domains") return { id, label: "新しい支援領域", description: "" } satisfies SupportDomain;
  if (tab === "triggers") return { id, label: "新しい先行条件", category: "未分類" } satisfies TriggerEntry;
  if (tab === "actNotices") return { id, label: "新しいACT通知", category: "未分類" } satisfies ActNoticeEntry;
  if (tab === "generationRules") return { id, triggerIds: [], actNoticeIds: [], suggestedActionIds: [], suggestedSupportIds: [], description: "" } satisfies GenerationRule;
  if (tab === "directions") return { id, domainIds: domainId ? [domainId] : [], label: "新しい方向性", sentence: "", ending: "ましょう" } satisfies DirectionEntry;
  if (tab === "situations") return { id, domainIds: domainId ? [domainId] : [], label: "新しい場面", sentence: "", sentenceConnector: "は" } satisfies SituationEntry;
  if (tab === "actions") return { id, domainIds: domainId ? [domainId] : [], label: "新しい行動", sentence: "", teForm: "", actionEnding: "みましょう" } satisfies ActionEntry;
  if (tab === "staffSupports") return { id, domainIds: domainId ? [domainId] : [], label: "新しい職員支援", sentence: "", subject: "職員は", lead: "", connector: "、", ending: "支援します" } satisfies StaffSupportEntry;
  return { id, domainIds: domainId ? [domainId] : [], label: "新しい語彙", sentence: "" };
}

function normalizeImportedDictionary(imported: Record<string, unknown>, fallback: SupportPlanDictionary): SupportPlanDictionary {
  const normalized = normalizeDictionary(imported);
  return {
    ...normalized,
    domains: normalized.domains.length ? normalized.domains : fallback.domains,
  };
}

function csvToArray(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function sampleSituationFor(action: ActionEntry, dictionary: SupportPlanDictionary): SituationEntry {
  return dictionary.situations.find((item) => item.domainIds.some((id) => action.domainIds.includes(id))) ?? {
    id: "preview_situation",
    domainIds: action.domainIds,
    label: "作業中に分からないことが出たとき",
    sentenceConnector: "は",
  };
}

function loadChangeLog(): DictionaryChangeLog[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHANGE_LOG_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed as DictionaryChangeLog[] : [];
  } catch {
    return [];
  }
}

function checkDictionary(dictionary: SupportPlanDictionary): DictionaryIssue[] {
  const issues: DictionaryIssue[] = [];
  const collections = [
    ["支援領域", dictionary.domains],
    ["方向性", dictionary.directions],
    ["場面", dictionary.situations],
    ["行動", dictionary.actions],
    ["職員支援", dictionary.staffSupports],
    ["先行条件", dictionary.triggers],
    ["ACT通知", dictionary.actNotices],
    ["支援候補ルール", dictionary.generationRules],
  ] as const;
  const allIds = new Map<string, string[]>();
  collections.forEach(([label, items]) => {
    items.forEach((item) => allIds.set(item.id, [...(allIds.get(item.id) ?? []), label]));
  });
  allIds.forEach((labels, id) => {
    if (labels.length > 1) issues.push({ level: "error", message: `IDが重複しています: ${id} (${labels.join(" / ")})` });
  });

  const vocabularies = [
    ["方向性", dictionary.directions],
    ["場面", dictionary.situations],
    ["行動", dictionary.actions],
    ["職員支援", dictionary.staffSupports],
  ] as const;
  vocabularies.forEach(([label, items]) => {
    items.filter((item) => !item.domainIds.length).forEach((item) => issues.push({ level: "error", message: `${label} ${item.id} の所属支援領域が空です。` }));
  });

  dictionary.directions.forEach((item) => {
    const text = generateDirectionText(item);
    if ([item.label, item.sentence].filter(Boolean).some((value) => value?.includes("本人は"))) issues.push({ level: "warning", message: `方向性 ${item.id} に「本人は」が入っています。` });
    if (!text.endsWith("ましょう。")) issues.push({ level: "warning", message: `方向性 ${item.id} の生成文が「ましょう。」で終わっていません。` });
  });
  dictionary.actions.forEach((item) => {
    if (!item.teForm?.trim() && !item.sentence?.trim()) issues.push({ level: "warning", message: `行動 ${item.id} に teForm がありません。` });
  });
  dictionary.staffSupports.forEach((item) => {
    if (!item.lead?.trim() && !item.sentence?.trim()) issues.push({ level: "warning", message: `職員支援 ${item.id} に lead がありません。` });
    if (!item.ending?.trim() && !item.sentence?.trim()) issues.push({ level: "warning", message: `職員支援 ${item.id} に ending がありません。` });
    const text = generateStaffSupportText(item);
    if (!text.startsWith("職員は") || !text.endsWith("支援します。")) issues.push({ level: "warning", message: `職員支援 ${item.id} の生成文が「職員は」で始まり「支援します。」で終わる形ではありません。` });
  });

  const triggerIds = new Set(dictionary.triggers.map((item) => item.id));
  const noticeIds = new Set(dictionary.actNotices.map((item) => item.id));
  const actionIds = new Set(dictionary.actions.map((item) => item.id));
  const supportIds = new Set(dictionary.staffSupports.map((item) => item.id));
  dictionary.generationRules.forEach((rule) => {
    (rule.triggerIds ?? []).filter((id) => !triggerIds.has(id)).forEach((id) => issues.push({ level: "error", message: `支援候補ルール ${rule.id} が存在しない先行条件ID ${id} を参照しています。` }));
    (rule.actNoticeIds ?? []).filter((id) => !noticeIds.has(id)).forEach((id) => issues.push({ level: "error", message: `支援候補ルール ${rule.id} が存在しないACT通知ID ${id} を参照しています。` }));
    (rule.suggestedActionIds ?? []).filter((id) => !actionIds.has(id)).forEach((id) => issues.push({ level: "error", message: `支援候補ルール ${rule.id} が削除済みまたは存在しない行動ID ${id} を参照しています。` }));
    (rule.suggestedSupportIds ?? []).filter((id) => !supportIds.has(id)).forEach((id) => issues.push({ level: "error", message: `支援候補ルール ${rule.id} が削除済みまたは存在しない職員支援ID ${id} を参照しています。` }));
  });
  return issues;
}

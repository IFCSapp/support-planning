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

type TabKey = "domains" | "directions" | "situations" | "actions" | "staffSupports" | "triggers" | "actNotices" | "generationRules";
type EditableEntry = { id: string; label?: string; description?: string };

type Props = {
  dictionary: SupportPlanDictionary;
  onChange: (dictionary: SupportPlanDictionary) => void;
};

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

export default function DictionaryViewer({ dictionary, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("domains");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const items = useMemo(() => {
    const source = dictionary[activeTab] as EditableEntry[];
    const keyword = query.trim();
    if (!keyword) return source;
    return source.filter((item) => [item.id, item.label, item.description].filter(Boolean).some((value) => value?.includes(keyword)));
  }, [activeTab, dictionary, query]);

  function updateCollection<T extends { id: string }>(key: TabKey, id: string, patch: Partial<T>) {
    onChange({ ...dictionary, [key]: (dictionary[key] as T[]).map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function addEntry() {
    const id = `${activeTab}_${Date.now()}`;
    const firstDomainId = dictionary.domains[0]?.id ?? "";
    const next = createEntry(activeTab, id, firstDomainId);
    onChange({ ...dictionary, [activeTab]: [...(dictionary[activeTab] as unknown[]), next] });
    setQuery("");
  }

  function removeEntry(id: string) {
    onChange({ ...dictionary, [activeTab]: (dictionary[activeTab] as EditableEntry[]).filter((item) => item.id !== id) });
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
      onChange(normalizeImportedDictionary(parsed, dictionary));
      setMessage("辞書JSONを読み込みました。");
    } catch {
      setMessage("辞書JSONを読み込めませんでした。");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
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
      <div className="panel dictionary-actions">
        <div className="button-row">
          <button className="primary" type="button" onClick={addEntry}>現在のタブに追加</button>
          <button type="button" onClick={exportDictionary}>辞書を書き出す</button>
          <button type="button" onClick={() => fileRef.current?.click()}>辞書を読み込む</button>
          <input ref={fileRef} className="hidden" type="file" accept="application/json" onChange={(event) => importDictionary(event.target.files?.[0])} />
        </div>
        {message && <p className="toast-inline">{message}</p>}
      </div>
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
      <label>支援操作と語尾の接続<input value={item.connector ?? "を行い、"} onChange={(event) => onChange({ connector: event.target.value })} placeholder="を行い、" /></label>
      <label>支援文の語尾<input value={item.ending ?? ""} onChange={(event) => onChange({ ending: event.target.value })} placeholder="取り組みやすくなるよう支援します" /></label>
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
      <label>先行条件ID<input value={(item.triggerIds ?? []).join(", ")} onChange={(event) => onChange({ triggerIds: csvToArray(event.target.value) })} placeholder={dictionary.triggers.slice(0, 3).map((entry) => entry.id).join(", ")} /></label>
      <label>ACT通知ID<input value={(item.actNoticeIds ?? []).join(", ")} onChange={(event) => onChange({ actNoticeIds: csvToArray(event.target.value) })} placeholder={dictionary.actNotices.slice(0, 3).map((entry) => entry.id).join(", ")} /></label>
      <label>おすすめ行動ID<input value={(item.suggestedActionIds ?? []).join(", ")} onChange={(event) => onChange({ suggestedActionIds: csvToArray(event.target.value) })} /></label>
      <label>おすすめ職員支援ID<input value={(item.suggestedSupportIds ?? []).join(", ")} onChange={(event) => onChange({ suggestedSupportIds: csvToArray(event.target.value) })} /></label>
      <label>短期目標案<input value={item.suggestedShortGoal ?? ""} onChange={(event) => onChange({ suggestedShortGoal: event.target.value })} /></label>
      <label>支援アイデアに表示する説明<textarea value={item.suggestedSupportOperation ?? ""} onChange={(event) => onChange({ suggestedSupportOperation: event.target.value })} /></label>
    </article>
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
  if (tab === "staffSupports") return { id, domainIds: domainId ? [domainId] : [], label: "新しい職員支援", sentence: "", subject: "職員は", lead: "", connector: "を行い、", ending: "支援します" } satisfies StaffSupportEntry;
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

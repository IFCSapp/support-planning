import { useMemo, useState } from "react";
import type { ActionEntry, DirectionEntry, SituationEntry, StaffSupportEntry, SupportDomain, SupportPlanDictionary } from "../types/dictionary";

type TabKey = "domains" | "directions" | "situations" | "actions" | "staffSupports";

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
];

export default function DictionaryViewer({ dictionary, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("domains");
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const source = dictionary[activeTab] as Array<{ id: string; label: string }>;
    return source.filter((item) => item.label.includes(query) || item.id.includes(query));
  }, [activeTab, dictionary, query]);

  function updateDomain(id: string, patch: Partial<SupportDomain>) {
    onChange({ ...dictionary, domains: dictionary.domains.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function updateDirection(id: string, patch: Partial<DirectionEntry>) {
    onChange({ ...dictionary, directions: dictionary.directions.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function updateSituation(id: string, patch: Partial<SituationEntry>) {
    onChange({ ...dictionary, situations: dictionary.situations.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function updateAction(id: string, patch: Partial<ActionEntry>) {
    onChange({ ...dictionary, actions: dictionary.actions.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function updateSupport(id: string, patch: Partial<StaffSupportEntry>) {
    onChange({ ...dictionary, staffSupports: dictionary.staffSupports.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  return (
    <section className="page">
      <div className="page-heading">
        <p className="eyebrow">辞書バージョン {dictionary.version}</p>
        <h1>辞書確認・編集</h1>
        <p className="muted">編集内容はこの端末のブラウザ内に保存されます。元のJSONファイルは変更しません。</p>
      </div>
      <div className="summary-grid">
        <span>領域 {dictionary.domains.length}</span>
        <span>方向性 {dictionary.directions.length}</span>
        <span>場面 {dictionary.situations.length}</span>
        <span>行動 {dictionary.actions.length}</span>
        <span>職員支援 {dictionary.staffSupports.length}</span>
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
            <small>{item.id}</small>
            <label>表示名<input value={item.label} onChange={(event) => updateDomain(item.id, { label: event.target.value })} /></label>
            <label>説明<textarea value={item.description ?? ""} onChange={(event) => updateDomain(item.id, { description: event.target.value })} /></label>
          </article>
        ))}
        {activeTab === "directions" && (items as DirectionEntry[]).map((item) => (
          <article className="list-item dictionary-entry" key={item.id}>
            <small>{item.id}</small>
            <label>ラベル<input value={item.label} onChange={(event) => updateDirection(item.id, { label: event.target.value })} /></label>
            <label>完成文<textarea value={item.sentence ?? ""} onChange={(event) => updateDirection(item.id, { sentence: event.target.value })} /></label>
          </article>
        ))}
        {activeTab === "situations" && (items as SituationEntry[]).map((item) => (
          <article className="list-item dictionary-entry" key={item.id}>
            <small>{item.id}</small>
            <label>ラベル<input value={item.label} onChange={(event) => updateSituation(item.id, { label: event.target.value })} /></label>
            <label>完成文<textarea value={item.sentence ?? ""} onChange={(event) => updateSituation(item.id, { sentence: event.target.value })} /></label>
          </article>
        ))}
        {activeTab === "actions" && (items as ActionEntry[]).map((item) => (
          <article className="list-item dictionary-entry" key={item.id}>
            <small>{item.id}</small>
            <label>ラベル<input value={item.label} onChange={(event) => updateAction(item.id, { label: event.target.value })} /></label>
            <label>完成文<textarea value={item.sentence ?? ""} onChange={(event) => updateAction(item.id, { sentence: event.target.value })} /></label>
          </article>
        ))}
        {activeTab === "staffSupports" && (items as StaffSupportEntry[]).map((item) => (
          <article className="list-item dictionary-entry" key={item.id}>
            <small>{item.id}</small>
            <label>ラベル<input value={item.label} onChange={(event) => updateSupport(item.id, { label: event.target.value })} /></label>
            <label>完成文<textarea value={item.sentence ?? ""} onChange={(event) => updateSupport(item.id, { sentence: event.target.value })} /></label>
          </article>
        ))}
        {!items.length && <p className="muted">該当する語彙はありません。</p>}
      </div>
    </section>
  );
}

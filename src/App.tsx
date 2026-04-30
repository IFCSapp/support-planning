import { useEffect, useMemo, useState } from "react";
import { loadDictionary } from "./data/dictionaryLoader";
import type { SupportPlanDictionary } from "./types/dictionary";
import { saveSetting } from "./storage/db";
import Layout, { type WorkflowHeader } from "./components/Layout";
import Home from "./components/Home";
import PlanWizard from "./components/PlanWizard";
import PlanList from "./components/PlanList";
import DictionaryViewer from "./components/DictionaryViewer";
import Settings from "./components/Settings";

const DICTIONARY_STORAGE_KEY = "support-plan-navi-dictionary";

export default function App() {
  const [dictionary, setDictionary] = useState<SupportPlanDictionary | null>(null);
  const [standardDictionary, setStandardDictionary] = useState<SupportPlanDictionary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [route, setRoute] = useState(window.location.hash.replace(/^#/, "") || "/");
  const [toast, setToast] = useState("");
  const [workflowHeader, setWorkflowHeader] = useState<WorkflowHeader | null>(null);

  useEffect(() => {
    loadDictionary()
      .then(async (loaded) => {
        const savedDictionary = localStorage.getItem(DICTIONARY_STORAGE_KEY);
        setStandardDictionary(loaded);
        setDictionary(savedDictionary ? JSON.parse(savedDictionary) as SupportPlanDictionary : loaded);
        await saveSetting("dictionaryVersion", loaded.version);
        await saveSetting("lastOpenedAt", new Date().toISOString());
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "辞書データを読み込めませんでした。dataフォルダに辞書JSONが配置されているか確認してください。"));
  }, []);

  useEffect(() => {
    const listener = () => setRoute(window.location.hash.replace(/^#/, "") || "/");
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    if (!/^\/plans\/new$/.test(route) && !/^\/plans\/[^/]+\/edit$/.test(route)) setWorkflowHeader(null);
  }, [route]);

  function navigate(nextRoute: string) {
    window.location.hash = nextRoute;
    setRoute(nextRoute);
  }

  function goBack() {
    if (route === "/") return;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate("/");
  }

  function copied() {
    setToast("コピーしました。");
    window.setTimeout(() => setToast(""), 1800);
  }

  function updateDictionary(nextDictionary: SupportPlanDictionary) {
    setDictionary(nextDictionary);
    localStorage.setItem(DICTIONARY_STORAGE_KEY, JSON.stringify(nextDictionary));
  }

  function resetDictionary() {
    if (!standardDictionary) return;
    updateDictionary(standardDictionary);
  }

  const editId = useMemo(() => route.match(/^\/plans\/([^/]+)\/edit$/)?.[1], [route]);
  const isPlanDetailRoute = /^\/plans\/[^/]+$/.test(route) && route !== "/plans/new";

  if (loadError) {
    return (
      <Layout route={route} workflowHeader={workflowHeader} onNavigate={navigate} onBack={goBack}>
        <section className="page">
          <div className="error-box">{loadError}</div>
        </section>
      </Layout>
    );
  }

  if (!dictionary) {
    return (
      <Layout route={route} workflowHeader={workflowHeader} onNavigate={navigate} onBack={goBack}>
        <section className="page"><p>辞書データを読み込んでいます。</p></section>
      </Layout>
    );
  }

  return (
    <Layout route={route} workflowHeader={workflowHeader} onNavigate={navigate} onBack={goBack}>
      {route === "/" && <Home onNavigate={navigate} />}
      {route === "/plans/new" && <PlanWizard dictionary={dictionary} onNavigate={navigate} onCopied={copied} onHeaderChange={setWorkflowHeader} />}
      {editId && <PlanWizard dictionary={dictionary} editId={editId} onNavigate={navigate} onCopied={copied} onHeaderChange={setWorkflowHeader} />}
      {(route === "/plans" || isPlanDetailRoute) && <PlanList route={route} dictionary={dictionary} onNavigate={navigate} onCopied={copied} />}
      {route === "/dictionary" && <DictionaryPage dictionary={dictionary} standardDictionary={standardDictionary ?? dictionary} onNavigate={navigate} onChange={updateDictionary} onReset={resetDictionary} />}
      {route === "/settings" && <SettingsPage dictionaryVersion={dictionary.version} onNavigate={navigate} />}
      {route === "/about" && <About dictionaryVersion={dictionary.version} onNavigate={navigate} />}
      <div className="sr-only" aria-live="polite">{toast}</div>
      {toast && <div className="toast no-print">{toast}</div>}
    </Layout>
  );
}

function DictionaryPage({ dictionary, standardDictionary, onNavigate, onChange, onReset }: { dictionary: SupportPlanDictionary; standardDictionary: SupportPlanDictionary; onNavigate: (route: string) => void; onChange: (dictionary: SupportPlanDictionary) => void; onReset: () => void }) {
  return (
    <>
      <div className="page button-row no-print">
        <button onClick={() => onNavigate("/")}>ホームへ戻る</button>
      </div>
      <DictionaryViewer dictionary={dictionary} standardDictionary={standardDictionary} onChange={onChange} onReset={onReset} />
    </>
  );
}

function SettingsPage({ dictionaryVersion, onNavigate }: { dictionaryVersion: string; onNavigate: (route: string) => void }) {
  return (
    <>
      <div className="page button-row no-print">
        <button onClick={() => onNavigate("/")}>ホームへ戻る</button>
      </div>
      <Settings dictionaryVersion={dictionaryVersion} onImported={() => undefined} />
    </>
  );
}

function About({ dictionaryVersion, onNavigate }: { dictionaryVersion: string; onNavigate: (route: string) => void }) {
  return (
    <section className="page">
      <div className="button-row no-print">
        <button onClick={() => onNavigate("/")}>ホームへ戻る</button>
      </div>
      <div className="page-heading">
        <p className="eyebrow">辞書バージョン {dictionaryVersion}</p>
        <h1>このアプリについて</h1>
        <p>このアプリは、本人を評価するためではなく、面談で出た言葉を支援計画の語彙へ整理するための補助ツールです。</p>
      </div>
      <div className="panel">
        <p>データは端末内のIndexedDBに保存され、外部API送信やクラウド保存は行いません。</p>
        <p>ACTは、不安や頭に浮かぶ言葉を消すためではなく、それがある場面でも次の一手を選ぶために使います。</p>
      </div>
    </section>
  );
}

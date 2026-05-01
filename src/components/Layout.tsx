import { useState, type ReactNode } from "react";

export type WorkflowHeader = {
  title: string;
  status: string;
  steps: string[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onComplete?: () => void;
  previousDisabled?: boolean;
  nextLabel?: string;
};

type Props = {
  children: ReactNode;
  route: string;
  workflowHeader?: WorkflowHeader | null;
  onNavigate: (route: string) => void;
  onBack: () => void;
};

export default function Layout({ children, route, workflowHeader, onNavigate, onBack }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const items = [
    ["/", "ホーム"],
    ["/plans", "計画一覧"],
    ["/plans/new", "新規作成"],
    ["/dictionary", "辞書確認"],
    ["/settings", "設定・バックアップ"],
    ["/about", "このアプリについて"],
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => onNavigate("/")}>支援計画ナビ</button>
        {route !== "/" && <button className="back-button no-print" onClick={() => onNavigate("/")}>ホーム</button>}

        {workflowHeader && (
          <div className="workflow-top" aria-label="進捗">
            <div className="workflow-current">
              <span>{workflowHeader.status}</span>
              <strong>{workflowHeader.title}</strong>
            </div>
            <div className="workflow-nav-actions no-print" aria-label="作成画面の操作">
              {workflowHeader.onPrevious && (
                <button
                  type="button"
                  className="workflow-nav-button"
                  disabled={workflowHeader.previousDisabled}
                  onClick={workflowHeader.onPrevious}
                >
                  戻る
                </button>
              )}

              {workflowHeader.currentStep < workflowHeader.steps.length - 1 ? (
                workflowHeader.onNext && (
                  <button
                    type="button"
                    className="workflow-nav-button primary"
                    onClick={workflowHeader.onNext}
                  >
                    {workflowHeader.nextLabel ?? "次へ"}
                  </button>
                )
              ) : (
                workflowHeader.onComplete && (
                  <button
                    type="button"
                    className="workflow-nav-button primary"
                    onClick={workflowHeader.onComplete}
                  >
                    保存して出力
                  </button>
                )
              )}
            </div>

            <ol className="workflow-steps">
              {workflowHeader.steps.map((label, index) => (
                <li key={label}>
                  <button
                    type="button"
                    className={
                      index === workflowHeader.currentStep
                        ? "workflow-step current"
                        : index < workflowHeader.currentStep
                          ? "workflow-step done"
                          : "workflow-step"
                    }
                    onClick={() => workflowHeader.onStepChange(index)}
                  >
                    {index + 1}. {label}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="app-menu no-print">
          <button type="button" className="menu-button" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            メニュー
          </button>
          {menuOpen && (
            <nav className="nav" aria-label="主要メニュー">
              {items.map(([href, label]) => (
                <button key={href} className={route === href ? "nav-item active" : "nav-item"} onClick={() => { onNavigate(href); setMenuOpen(false); }}>
                  {label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

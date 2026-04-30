import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  route: string;
  onNavigate: (route: string) => void;
  onBack: () => void;
};

export default function Layout({ children, route, onNavigate, onBack }: Props) {
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
        {route !== "/" && <button className="back-button no-print" onClick={onBack}>前に戻る</button>}
        <nav className="nav" aria-label="主要メニュー">
          {items.map(([href, label]) => (
            <button key={href} className={route === href ? "nav-item active" : "nav-item"} onClick={() => onNavigate(href)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

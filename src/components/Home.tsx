type Props = {
  onNavigate: (route: string) => void;
};

export default function Home({ onNavigate }: Props) {
  return (
    <section className="page">
      <div className="page-heading">
        <p className="eyebrow">端末内保存型PWA</p>
        <h1>支援計画ナビ</h1>
        <p>面談しながら、本人向けの個別支援計画文を作成するためのツールです。</p>
      </div>
      <div className="action-grid">
        <button className="primary" onClick={() => onNavigate("/plans/new")}>新しい計画を作る</button>
        <button onClick={() => onNavigate("/plans")}>保存済み計画を見る</button>
        <button onClick={() => onNavigate("/dictionary")}>辞書を確認する</button>
        <button onClick={() => onNavigate("/settings")}>設定・バックアップ</button>
      </div>
      <aside className="notice">
        <p>このアプリは、面談内容を整理し、個別支援計画の文案を作るための補助ツールです。</p>
        <p>記録は端末内に保存されます。</p>
        <p>本人の同意なく、個人情報を外部に共有しないでください。</p>
      </aside>
    </section>
  );
}

import { useRef, useState } from "react";
import type { BackupFile } from "../types/plan";
import { createBackup, importBackup } from "../storage/backup";

type Props = {
  dictionaryVersion: string;
  onImported: () => void;
  onNavigate?: (route: string) => void;
};

export default function Settings({ dictionaryVersion, onImported, onNavigate }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  async function exportJson() {
    const backup = await createBackup(dictionaryVersion);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `support-plan-navi-backup-${backup.exportedAt.slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("バックアップJSONを書き出しました。");
  }

  async function importJson(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile;
      const count = await importBackup(parsed);
      setMessage(`${count}件の計画を読み込みました。`);
      onImported();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "JSONを読み込めませんでした。");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="page">
      <div className="page-heading">
        <p className="eyebrow">辞書バージョン {dictionaryVersion}</p>
        <h1>設定・バックアップ</h1>
      </div>
      <div className="panel">
        <h2>JSONバックアップ</h2>
        <p className="muted">
          このバックアップは、保存済み計画と設定を書き出します。編集済み辞書は含まれません。
          辞書を別の端末へ移す場合は、「辞書を確認する」画面の「編集済み辞書を書き出す／読み込む」を使ってください。
        </p>
        <div className="button-row">
          <button className="primary" onClick={exportJson}>JSONを書き出す</button>
          <button onClick={() => fileRef.current?.click()}>JSONを読み込む</button>
          {onNavigate && <button onClick={() => onNavigate("/dictionary")}>辞書を確認する</button>}
          <input ref={fileRef} className="hidden" type="file" accept="application/json" onChange={(event) => importJson(event.target.files?.[0])} />
        </div>
        {message && <p className="toast-inline">{message}</p>}
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import type { SupportPlanDictionary } from "../types/dictionary";
import type { SupportPlanDraft } from "../types/plan";
import { deletePlan, getPlan, listPlans, savePlan } from "../storage/db";
import { createId } from "../utils/id";
import { formatDateTime } from "../utils/date";
import CopyButtons from "./CopyButtons";
import QualityWarnings from "./QualityWarnings";

type Props = {
  route: string;
  dictionary: SupportPlanDictionary;
  onNavigate: (route: string) => void;
  onCopied: () => void;
};

export default function PlanList({ route, dictionary, onNavigate, onCopied }: Props) {
  const [plans, setPlans] = useState<SupportPlanDraft[]>([]);
  const detailId = route.match(/^\/plans\/([^/]+)$/)?.[1];
  const [detail, setDetail] = useState<SupportPlanDraft | null>(null);

  async function refresh() {
    setPlans(await listPlans());
  }

  useEffect(() => {
    refresh();
  }, [route]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      return;
    }
    getPlan(detailId).then((plan) => setDetail(plan ?? null));
  }, [detailId]);

  async function duplicate(plan: SupportPlanDraft) {
    const copy = { ...plan, id: createId("plan"), status: "draft" as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await savePlan(copy);
    await refresh();
    onNavigate(`/plans/${copy.id}/edit`);
  }

  async function remove(id: string) {
    if (!confirm("この計画を削除しますか？")) return;
    await deletePlan(id);
    await refresh();
    onNavigate("/plans");
  }

  if (detailId) {
    return (
      <section className="page print-page">
        <div className="button-row no-print">
          <button onClick={() => onNavigate("/plans")}>計画一覧へ戻る</button>
        </div>
        <div className="page-heading">
          <p className="eyebrow">計画詳細</p>
          <h1>{detail?.clientInfo.displayName || "読み込み中"}</h1>
        </div>
        {detail ? (
          <>
            <div className="button-row no-print">
              <button className="primary" onClick={() => onNavigate(`/plans/${detail.id}/edit`)}>編集</button>
              <button onClick={() => duplicate(detail)}>複製して編集</button>
              <button onClick={() => window.print()}>印刷</button>
              <button className="danger" onClick={() => remove(detail.id)}>削除</button>
            </div>
            <div className="panel">
              <p>作成日: {formatDateTime(detail.createdAt)} / 更新日: {formatDateTime(detail.updatedAt)}</p>
              <p>辞書バージョン: {detail.dictionaryVersion || dictionary.version}</p>
              <p>計画期間: {detail.clientInfo.planStartDate || ""} - {detail.clientInfo.planEndDate || ""}</p>
              <p>担当職員: {detail.clientInfo.staffName || ""}</p>
            </div>
            {detail.blocks.map((block, index) => (
              <article className="print-block" key={block.id}>
                <h2>支援計画 {index + 1}</h2>
                <p>{block.directionText}</p>
                <p>{block.actionText}</p>
                <p>{block.staffSupportText}</p>
                <QualityWarnings warnings={block.qualityWarnings} />
              </article>
            ))}
            <CopyButtons plan={detail} onCopied={onCopied} />
          </>
        ) : (
          <p>計画が見つかりませんでした。</p>
        )}
      </section>
    );
  }

  return (
    <section className="page">
      <div className="button-row no-print">
        <button onClick={() => onNavigate("/")}>ホームへ戻る</button>
      </div>
      <div className="page-heading">
        <p className="eyebrow">端末内保存</p>
        <h1>計画一覧</h1>
      </div>
      <div className="button-row">
        <button className="primary" onClick={() => onNavigate("/plans/new")}>新しい計画を作る</button>
      </div>
      <div className="list">
        {plans.map((plan) => (
          <article className="list-item" key={plan.id}>
            <h2>{plan.clientInfo.displayName || "名称未入力"}</h2>
            <p>{plan.blocks[0]?.directionText || "方向性未設定"} / {formatDateTime(plan.updatedAt)}</p>
            <div className="button-row">
              <button onClick={() => onNavigate(`/plans/${plan.id}`)}>詳細</button>
              <button onClick={() => onNavigate(`/plans/${plan.id}/edit`)}>編集</button>
            </div>
          </article>
        ))}
        {!plans.length && <p className="muted">保存済み計画はまだありません。</p>}
      </div>
    </section>
  );
}

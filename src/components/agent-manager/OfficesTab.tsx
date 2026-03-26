import type { Office } from "../../types";
import type { Translator } from "./types";

interface OfficesTabProps {
  tr: Translator;
  offices: Office[];
  officeSecretaryLabels?: Record<string, string>;
  onEditOffice: (office: Office) => void;
  onDeleteOffice: (office: Office) => void;
}

export default function OfficesTab({ tr, offices, officeSecretaryLabels = {}, onEditOffice, onDeleteOffice }: OfficesTabProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {offices
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((office) => (
            <div
              key={office.id}
              className="group flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/5"
              style={{ background: "var(--th-card-bg)", border: "1px solid var(--th-card-border)" }}
            >
              <span className="text-2xl">{office.icon}</span>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: "var(--th-text-heading)" }}>
                  {office.name}
                </div>
                {office.description && (
                  <div className="text-xs mt-0.5 truncate" style={{ color: "var(--th-text-muted)" }}>
                    {office.description}
                  </div>
                )}
              </div>

              <div className="min-w-[140px] text-right text-xs" style={{ color: "var(--th-text-muted)" }}>
                {officeSecretaryLabels[office.id]
                  ? `${tr("负责人", "Owner")}: ${officeSecretaryLabels[office.id]}`
                  : tr("负责人: 未绑定", "Owner: Unassigned")}
              </div>

              <button
                onClick={() => onEditOffice(office)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100 hover:bg-white/10"
                style={{ color: "var(--th-text-muted)" }}
              >
                {tr("编辑", "Edit")}
              </button>
              <button
                onClick={() => onDeleteOffice(office)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400"
                style={{ color: "var(--th-text-muted)" }}
              >
                {tr("删除", "Delete")}
              </button>
            </div>
          ))}
      </div>

      {offices.length === 0 && (
        <div className="text-center py-16" style={{ color: "var(--th-text-muted)" }}>
          <div className="text-3xl mb-2">🏗️</div>
          {tr("暂无已创建办公室。", "No offices found.")}
        </div>
      )}
    </div>
  );
}

import type { Dictionary } from "../../lib/i18n/getDictionary.js";
import { type AuditEvent } from "../../lib/audit/auditLog.js";
import { entityName, fieldLabel, formatAuditValue, type AuditNames } from "../../lib/audit/formatAudit.js";
import { formatDayHeading, formatTime, localDayKey } from "../../lib/format.js";

const ACTION_TONE: Record<AuditEvent["action"], string> = {
  created: "text-status-healthy",
  updated: "text-primary",
  deleted: "text-status-danger",
};

/** Audit events grouped by local day: time · type · name · action, then each field's before → after. */
export function AuditLogList({
  events,
  names,
  dict,
  lang,
}: {
  events: AuditEvent[];
  names: AuditNames;
  dict: Dictionary;
  lang: string;
}) {
  if (events.length === 0) return <p className="text-body-md text-on-surface-variant py-4">{dict.audit.empty}</p>;

  const days: { key: string; heading: string; events: AuditEvent[] }[] = [];
  for (const event of events) {
    const key = localDayKey(event.recordedAt);
    const last = days[days.length - 1];
    if (last && last.key === key) last.events.push(event);
    else days.push({ key, heading: formatDayHeading(event.recordedAt, lang), events: [event] });
  }

  return (
    <div className="flex flex-col gap-6">
      {days.map((day) => (
        <section key={day.key}>
          <h4 className="eyebrow mb-1">{day.heading}</h4>
          <ol className="divide-y divide-outline-variant border-y border-outline-variant">
            {day.events.map((event) => (
              <li key={event.id} className="py-3 grid grid-cols-[4.5rem_1fr] gap-x-3">
                <time dateTime={event.recordedAt} className="font-mono text-label-sm text-on-surface-variant pt-0.5 whitespace-nowrap">
                  {formatTime(event.recordedAt, lang)}
                </time>
                <div className="min-w-0">
                  <p className="text-body-md text-on-surface flex flex-wrap items-baseline gap-x-2">
                    <span className="text-label-sm text-on-surface-variant border border-outline-variant rounded-sm px-1.5 py-px">
                      {dict.audit.types[event.entityType]}
                    </span>
                    <span className="font-medium break-words">{entityName(event, dict, names)}</span>
                    <span className={`text-label-md ${ACTION_TONE[event.action]}`}>{dict.audit.actions[event.action]}</span>
                  </p>
                  {event.changes.length > 0 ? (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {event.changes.map((change) => (
                        <li key={change.path} className="text-body-sm grid grid-cols-1 sm:grid-cols-[minmax(9rem,14rem)_1fr] gap-x-3">
                          <span className="text-on-surface-variant">{fieldLabel(change.path, dict)}</span>
                          <span className="min-w-0 break-words">
                            <span className="text-on-surface-variant">{formatAuditValue(change.path, change.before, lang, dict, names)}</span>
                            <span aria-hidden className="mx-1.5 text-outline">→</span>
                            <span className="text-on-surface font-medium">{formatAuditValue(change.path, change.after, lang, dict, names)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

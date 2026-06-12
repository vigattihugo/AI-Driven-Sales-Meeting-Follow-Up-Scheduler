import { Check, Clock, Loader2, Mail, Play, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  FollowUpApproval,
  SuggestedSlot,
  listApprovals,
  respondToApproval,
  runFollowUpJob
} from "./api.js";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function durationLabel(start: string, end: string) {
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
  return `${minutes} min`;
}

export function App() {
  const [approvals, setApprovals] = useState<FollowUpApproval[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedSlots, setSelectedSlots] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function load() {
    setLoading(true);
    try {
      const next = await listApprovals();
      setApprovals(next);
      setSelectedId((current) => current ?? next[0]?.id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((error) => setNotice(error.message));
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return approvals;
    }

    return approvals.filter((approval) =>
      `${approval.contactEmail} ${approval.meetingSummary} ${approval.status}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [approvals, query]);

  const selectedApproval = filtered.find((approval) => approval.id === selectedId) ?? filtered[0];
  const pendingCount = approvals.filter((approval) => approval.status === "pending").length;
  const approvedCount = approvals.filter((approval) => approval.status === "approved").length;

  async function runJob() {
    setBusyAction("run");
    setNotice(undefined);
    try {
      const result = await runFollowUpJob();
      setNotice(`${result.scanned} reuniões analisadas, ${result.approvalsSent} aprovações enviadas.`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Erro ao rodar rotina.");
    } finally {
      setBusyAction(undefined);
    }
  }

  async function respond(id: string, decision: "approve" | "decline") {
    setBusyAction(`${decision}:${id}`);
    setNotice(undefined);
    try {
      await respondToApproval(id, {
        decision,
        slotStart: decision === "approve" ? selectedSlots[id] : undefined
      });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Erro ao responder aprovação.");
    } finally {
      setBusyAction(undefined);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sales follow-up agent</p>
          <h1>Approval Queue</h1>
        </div>
        <div className="actions">
          <button className="iconButton" onClick={() => load()} title="Atualizar" disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          </button>
          <button className="primaryButton" onClick={runJob} disabled={Boolean(busyAction)}>
            {busyAction === "run" ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
            Rodar agora
          </button>
        </div>
      </header>

      <section className="metrics" aria-label="Resumo">
        <Metric label="Pendentes" value={pendingCount} tone="amber" />
        <Metric label="Aprovados" value={approvedCount} tone="green" />
        <Metric label="Total" value={approvals.length} tone="blue" />
      </section>

      {notice ? <div className="notice">{notice}</div> : null}

      <section className="workspace">
        <aside className="queue">
          <div className="search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar lead, reunião ou status"
            />
          </div>

          <div className="queueList">
            {filtered.map((approval) => (
              <button
                className={`queueItem ${approval.id === selectedApproval?.id ? "active" : ""}`}
                key={approval.id}
                onClick={() => setSelectedId(approval.id)}
              >
                <span className={`statusDot ${approval.status}`} />
                <span>
                  <strong>{approval.contactEmail}</strong>
                  <small>{formatDate(approval.meetingStart)} · {approval.status}</small>
                </span>
              </button>
            ))}

            {!filtered.length ? <p className="empty">Nenhum follow-up encontrado.</p> : null}
          </div>
        </aside>

        <section className="detail">
          {selectedApproval ? (
            <ApprovalDetail
              approval={selectedApproval}
              selectedSlot={selectedSlots[selectedApproval.id] ?? selectedApproval.slots[0]?.start}
              onSelectSlot={(slot) => setSelectedSlots((current) => ({
                ...current,
                [selectedApproval.id]: slot.start
              }))}
              onApprove={() => respond(selectedApproval.id, "approve")}
              onDecline={() => respond(selectedApproval.id, "decline")}
              busyAction={busyAction}
            />
          ) : (
            <div className="emptyState">A fila ainda está vazia.</div>
          )}
        </section>
      </section>
    </main>
  );
}

function Metric(props: { label: string; value: number; tone: "amber" | "green" | "blue" }) {
  return (
    <div className={`metric ${props.tone}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function ApprovalDetail(props: {
  approval: FollowUpApproval;
  selectedSlot?: string;
  onSelectSlot: (slot: SuggestedSlot) => void;
  onApprove: () => void;
  onDecline: () => void;
  busyAction?: string;
}) {
  const { approval } = props;
  const isPending = approval.status === "pending";

  return (
    <>
      <div className="detailHeader">
        <div>
          <p className="eyebrow">Lead</p>
          <h2>{approval.contactEmail}</h2>
        </div>
        <span className={`badge ${approval.status}`}>{approval.status}</span>
      </div>

      <div className="infoGrid">
        <Info icon={<Mail size={18} />} label="Reunião original" value={approval.meetingSummary} />
        <Info icon={<Clock size={18} />} label="Quando" value={`${formatDate(approval.meetingStart)} · ${durationLabel(approval.meetingStart, approval.meetingEnd)}`} />
      </div>

      <div className="sectionHeader">
        <h3>Slots sugeridos</h3>
      </div>

      <div className="slots">
        {approval.slots.map((slot) => (
          <button
            key={slot.id}
            className={`slot ${props.selectedSlot === slot.start ? "selected" : ""}`}
            onClick={() => props.onSelectSlot(slot)}
            disabled={!isPending}
          >
            <span>{formatDate(slot.start)}</span>
            <small>{durationLabel(slot.start, slot.end)}</small>
          </button>
        ))}
        {!approval.slots.length ? <p className="empty">Sem horários disponíveis.</p> : null}
      </div>

      <div className="detailActions">
        <button
          className="dangerButton"
          onClick={props.onDecline}
          disabled={!isPending || Boolean(props.busyAction)}
        >
          {props.busyAction === `decline:${approval.id}` ? <Loader2 className="spin" size={18} /> : <X size={18} />}
          Recusar
        </button>
        <button
          className="successButton"
          onClick={props.onApprove}
          disabled={!isPending || !approval.slots.length || Boolean(props.busyAction)}
        >
          {props.busyAction === `approve:${approval.id}` ? <Loader2 className="spin" size={18} /> : <Check size={18} />}
          Aprovar
        </button>
      </div>
    </>
  );
}

function Info(props: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="info">
      {props.icon}
      <span>
        <small>{props.label}</small>
        <strong>{props.value}</strong>
      </span>
    </div>
  );
}

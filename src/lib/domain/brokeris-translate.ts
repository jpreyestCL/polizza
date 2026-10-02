import { assignRenewalLineage } from "@/lib/domain/brokeris-chain";
import {
  mapBrokerisClaimClosure,
  mapBrokerisClaimStatus,
  mapBrokerisClaimSubstatus,
  mapBrokerisDocumentType,
  mapBrokerisEndorsement,
  mapBrokerisMovementKind,
  mapBrokerisNonRenewalReason,
  mapBrokerisNonRenewalType,
  mapBrokerisProposalStatus,
} from "@/lib/domain/brokeris-map";

export const BROKERIS_PASTE_PROFILES = [
  "POLIZAS",
  "ENDOSOS",
  "SINIESTROS",
  "DOCUMENTOS",
  "NO_RENOVACION",
] as const;

export type BrokerisPasteProfile = (typeof BROKERIS_PASTE_PROFILES)[number];

export type BrokerisTranslatedRow = {
  rowNo: number;
  action: "TRADUCIDO" | "REVISAR";
  payload: Record<string, unknown>;
  message: string;
};

function cells(line: string): string[] {
  const tab = line.split("\t").map((part) => part.trim());
  if (tab.length > 1) return tab;
  return line.split(";").map((part) => part.trim());
}

function lines(raw: string): string[][] {
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map(cells);
  if (rows.length > 0 && rows[0][0]?.toLowerCase() === "id") rows.shift();
  return rows;
}

function numberAt(row: string[], index: number): number | null {
  const raw = row[index];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function isBrokerisPasteProfile(value: string): value is BrokerisPasteProfile {
  return (BROKERIS_PASTE_PROFILES as readonly string[]).includes(value);
}

export function translateBrokerisPaste(
  profile: BrokerisPasteProfile,
  raw: string,
): BrokerisTranslatedRow[] {
  const parsed = lines(raw);
  if (profile === "POLIZAS") return translatePolicies(parsed);
  if (profile === "ENDOSOS") return translateEndorsements(parsed);
  if (profile === "SINIESTROS") return translateClaims(parsed);
  if (profile === "DOCUMENTOS") return translateDocuments(parsed);
  return translateNonRenewals(parsed);
}

function translatePolicies(parsed: string[][]): BrokerisTranslatedRow[] {
  const drafts = parsed.map((row, index) => {
    const id = row[0] || `fila-${index + 1}`;
    const statusCode = numberAt(row, 1);
    const renewalFlag = row[2] === "1" || row[2]?.toLowerCase() === "si";
    const mother = row[3] || null;
    const sortKey = row[4] || "";
    const status = statusCode == null ? null : mapBrokerisProposalStatus(statusCode);
    return { rowNo: index + 1, id, statusCode, status, renewalFlag, mother, sortKey };
  });
  const chain = assignRenewalLineage(
    drafts.map((row) => ({
      id: row.id,
      renewedFromId: row.renewalFlag && row.mother ? row.mother : null,
      sortKey: row.sortKey,
    })),
  );
  const byId = new Map(chain.map((row) => [row.id, row]));
  return drafts.map((row) => {
    const link = byId.get(row.id);
    const notes: string[] = [];
    if (!row.status?.status) notes.push("Estado sin mapa.");
    if (row.renewalFlag && !row.mother) notes.push("Renovación sin póliza madre.");
    if (link?.note) notes.push(link.note);
    const mapped = row.status?.status ?? "sin mapa";
    const observation = row.status?.insurerObservation ? ", con observación" : "";
    const chainText = link ? `, cadena ${link.lineageId} período ${link.termNumber}` : "";
    return {
      rowNo: row.rowNo,
      action: notes.length === 0 ? "TRADUCIDO" : "REVISAR",
      payload: {
        id: row.id,
        status: row.status?.status ?? null,
        insurerObservation: row.status?.insurerObservation ?? false,
        lineageId: link?.lineageId ?? null,
        termNumber: link?.termNumber ?? null,
        renewedFromId: link?.renewedFromId ?? null,
      },
      message: `${row.id}: estado ${row.statusCode ?? "—"} → ${mapped}${observation}${chainText}${
        notes.length ? `. ${notes.join(" ")}` : ""
      }`,
    };
  });
}

function translateEndorsements(parsed: string[][]): BrokerisTranslatedRow[] {
  return parsed.map((row, index) => {
    const id = row[0] || `fila-${index + 1}`;
    const typeId = numberAt(row, 1);
    const kind = typeId == null ? null : mapBrokerisMovementKind(typeId);
    const mapped = typeId == null ? null : mapBrokerisEndorsement(typeId);
    const notes: string[] = [];
    if (kind === "ISSUE") notes.push("Es la emisión, no un endoso.");
    if (typeId != null && kind == null) notes.push("Tipo sin mapa.");
    const label = kind === "ISSUE" ? "ISSUE" : (mapped?.code ?? "sin mapa");
    const who = mapped ? `, inicia ${mapped.initiatedBy}, método ${mapped.calcMethod}` : "";
    return {
      rowNo: index + 1,
      action: notes.length === 0 && mapped ? "TRADUCIDO" : "REVISAR",
      payload: {
        id,
        typeId,
        movementKind: kind,
        code: mapped?.code ?? null,
        initiatedBy: mapped?.initiatedBy ?? null,
        calcMethod: mapped?.calcMethod ?? null,
        mvpEnabled: mapped?.mvpEnabled ?? null,
        partyChangeKind: mapped?.partyChangeKind ?? null,
        note: mapped?.note ?? null,
      },
      message: `${id}: tipo ${typeId ?? "—"} → ${label}${who}${notes.length ? `. ${notes.join(" ")}` : ""}${
        mapped?.note ? `. ${mapped.note}` : ""
      }`,
    };
  });
}

function translateClaims(parsed: string[][]): BrokerisTranslatedRow[] {
  return parsed.map((row, index) => {
    const id = row[0] || `fila-${index + 1}`;
    const statusId = numberAt(row, 1);
    const substatusId = numberAt(row, 2);
    const closureId = numberAt(row, 3);
    const status = statusId == null ? null : mapBrokerisClaimStatus(statusId);
    const substatus = substatusId == null ? null : mapBrokerisClaimSubstatus(substatusId);
    const closure = closureId == null ? null : mapBrokerisClaimClosure(closureId);
    const notes: string[] = [];
    if (!status) notes.push("Estado sin mapa.");
    if (substatus?.note) notes.push(substatus.note);
    if (closureId != null && !closure) notes.push("Cierre sin mapa.");
    return {
      rowNo: index + 1,
      action: notes.length === 0 ? "TRADUCIDO" : "REVISAR",
      payload: {
        id,
        status,
        substatus: substatus?.status ?? null,
        closureOutcome: closure?.outcome ?? null,
        closureLabel: closure?.label ?? null,
      },
      message: `${id}: estado ${status ?? "sin mapa"}${
        substatus ? `, subestado ${substatus.status}` : ""
      }${closure ? `, cierre ${closure.outcome}` : ""}${notes.length ? `. ${notes.join(" ")}` : ""}`,
    };
  });
}

function translateDocuments(parsed: string[][]): BrokerisTranslatedRow[] {
  return parsed.map((row, index) => {
    const id = row[0] || `fila-${index + 1}`;
    const mapped = mapBrokerisDocumentType(row[1] ?? "");
    return {
      rowNo: index + 1,
      action: mapped.needsReview ? "REVISAR" : "TRADUCIDO",
      payload: mapped,
      message: `${id}: «${mapped.legacyType || "sin etiqueta"}» → ${mapped.code}${
        mapped.needsReview ? ". Queda para revisar." : ""
      }`,
    };
  });
}

function translateNonRenewals(parsed: string[][]): BrokerisTranslatedRow[] {
  return parsed.map((row, index) => {
    const id = row[0] || `fila-${index + 1}`;
    const typeId = numberAt(row, 1);
    const reasonId = numberAt(row, 2);
    const type = typeId == null ? null : mapBrokerisNonRenewalType(typeId);
    const reason = reasonId == null ? null : mapBrokerisNonRenewalReason(reasonId);
    const notes: string[] = [];
    if (!type) notes.push("Tipo sin mapa.");
    if (type === "NOT_RENEWED" && reasonId != null && !reason) notes.push("Motivo sin mapa.");
    return {
      rowNo: index + 1,
      action: notes.length === 0 ? "TRADUCIDO" : "REVISAR",
      payload: { id, type, reason },
      message: `${id}: ${type ?? "sin mapa"}${reason ? `, motivo ${reason}` : ""}${
        notes.length ? `. ${notes.join(" ")}` : ""
      }`,
    };
  });
}

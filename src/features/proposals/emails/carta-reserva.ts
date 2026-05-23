import "server-only";
import { emailLayout } from "@/server/email";

export type CartaReservaVars = {
  proposalNumber: string;
  contratanteName: string;
  contratanteRut: string;
  ramoName: string;
  productoName: string;
  startDate: string; // formato dd-mm-yyyy
  endDate: string;
  reservaDays: number;
  organizationName: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Asunto del correo. Usa dos puntos en lugar de raya. */
export function cartaReservaSubject(proposalNumber: string): string {
  return `Carta de reserva: Propuesta ${proposalNumber}`;
}

export function cartaReservaText(vars: CartaReservaVars): string {
  const intro = `Por medio de la presente, solicitamos reserva por ${vars.reservaDays} días para la propuesta N° ${vars.proposalNumber} del contratante ${vars.contratanteName} (${vars.contratanteRut}), ramo ${vars.ramoName}, producto ${vars.productoName}, con vigencia ${vars.startDate} al ${vars.endDate}.`;
  const cierre = `Agradecemos su pronta confirmación.\n\nLes saluda atentamente,\n${vars.organizationName}`;
  return `Estimados,\n\n${intro}\n\n${cierre}`;
}

export function cartaReservaHtml(vars: CartaReservaVars): string {
  const safe = {
    proposalNumber: escapeHtml(vars.proposalNumber),
    contratanteName: escapeHtml(vars.contratanteName),
    contratanteRut: escapeHtml(vars.contratanteRut),
    ramoName: escapeHtml(vars.ramoName),
    productoName: escapeHtml(vars.productoName),
    startDate: escapeHtml(vars.startDate),
    endDate: escapeHtml(vars.endDate),
    organizationName: escapeHtml(vars.organizationName),
  };
  const body = `
    <p>Estimados,</p>
    <p>Por medio de la presente, solicitamos reserva por <b>${vars.reservaDays} días</b> para la propuesta N° <b>${safe.proposalNumber}</b> del contratante <b>${safe.contratanteName}</b> (${safe.contratanteRut}), ramo <b>${safe.ramoName}</b>, producto <b>${safe.productoName}</b>, con vigencia ${safe.startDate} al ${safe.endDate}.</p>
    <p>Agradecemos su pronta confirmación.</p>
    <p>Les saluda atentamente,<br/>${safe.organizationName}</p>
  `;
  return emailLayout(cartaReservaSubject(safe.proposalNumber), body);
}

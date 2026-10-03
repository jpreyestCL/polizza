export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "settings.updated": "Parámetros actualizados",
  "auth.login.success": "Inicio de sesión",
  "mfa.enrolled": "Segundo factor activado",
  "mfa.verified": "Segundo factor verificado",
  "member.invited": "Miembro invitado",
  "member.invitation_cancelled": "Invitación cancelada",
  "member.role_changed": "Rol de miembro actualizado",
  "member.removed": "Miembro eliminado",
  "collection_reminder_sent": "Recordatorio de cobranza enviado",
  "installments.collected_edited": "Cobro de cuota corregido",
  "installments.written_off": "Cuota castigada",
  "documents.deleted": "Documento eliminado",
  "privacy_request_created": "Solicitud de privacidad creada",
  "privacy_request_transitioned": "Solicitud de privacidad actualizada",
  "privacy_subject_exported": "Datos del titular exportados",
  "compliance_obligation_created": "Obligación creada",
  "compliance_obligation_updated": "Obligación actualizada",
  "compliance_obligation_resolved": "Obligación resuelta",
  "compliance_obligation_deleted": "Obligación eliminada",
  "imports.apply": "Lote de importación aplicado",
  "imports.revert": "Lote de importación revertido",
  "imports.preview": "Archivo de importación previsualizado",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const COLOR_PRIMARY = "#0f4c50";
const COLOR_BORDER = "#1f2937";
const COLOR_HEADER_BG = "#1f2937";
const COLOR_LIGHT_BG = "#f3f4f6";
const COLOR_TEXT = "#1f2937";
const COLOR_MUTED = "#6b7280";

const styles = StyleSheet.create({
  page: {
    padding: 28,
    paddingBottom: 60,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: COLOR_TEXT,
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  brokerName: {
    fontSize: 11,
    fontWeight: "bold",
    color: COLOR_PRIMARY,
  },
  brokerSub: { fontSize: 8, color: COLOR_MUTED },
  companyLogoBox: { width: 110, height: 36, alignItems: "flex-end" },
  companyLogo: { maxWidth: 110, maxHeight: 36, objectFit: "contain" },
  title: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "bold",
    marginVertical: 6,
  },
  subtitle: { textAlign: "center", fontSize: 9, marginBottom: 4 },
  sectionBar: {
    backgroundColor: COLOR_HEADER_BG,
    color: "white",
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 9,
    fontWeight: "bold",
    marginTop: 6,
  },
  row: { flexDirection: "row", flexWrap: "wrap" },
  cell3: { width: "33.33%", paddingHorizontal: 4, paddingVertical: 2 },
  cell4: { width: "25%", paddingHorizontal: 4, paddingVertical: 2 },
  cell2: { width: "50%", paddingHorizontal: 4, paddingVertical: 2 },
  cell6: { width: "16.66%", paddingHorizontal: 4, paddingVertical: 2 },
  labelMuted: { color: COLOR_MUTED, fontSize: 7 },
  labelBold: { fontWeight: "bold", fontSize: 8 },
  borderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderBottom: 0.5,
    borderBottomColor: COLOR_BORDER,
    paddingVertical: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLOR_LIGHT_BG,
    borderBottom: 0.5,
    borderBottomColor: COLOR_BORDER,
    padding: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: 0.3,
    borderBottomColor: "#d1d5db",
    padding: 2,
  },
  tableFooter: {
    flexDirection: "row",
    backgroundColor: COLOR_LIGHT_BG,
    borderTop: 0.5,
    borderTopColor: COLOR_BORDER,
    padding: 2,
    fontWeight: "bold",
  },
  th: { fontSize: 7, fontWeight: "bold" },
  td: { fontSize: 7 },
  paymentBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  paymentOpt: { fontSize: 8, marginRight: 12 },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 24,
  },
  signBox: { width: "30%", alignItems: "center" },
  signLine: {
    width: "100%",
    borderTop: 0.5,
    borderTopColor: COLOR_BORDER,
    paddingTop: 2,
    fontSize: 8,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 28,
    right: 28,
    fontSize: 7,
    color: COLOR_MUTED,
    textAlign: "center",
  },
  observations: {
    paddingHorizontal: 4,
    paddingVertical: 3,
    fontSize: 8,
    lineHeight: 1.3,
  },
});

type Party = {
  name: string;
  rut: string | null;
  address: string | null;
  commune: string | null;
  region: string | null;
};

export type PdfProposal = {
  proposalNumber: string;
  createdAt: Date;
  sentAt: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  currency: string;
  observations: string | null;
  isRenovation: boolean;
  previousPolicyNumber: string | null;
  quotationNumberRef: string | null;
  organizationName: string;
  // Cliente / Contratante
  clientType: string;
  clientName: string;
  clientFirstName: string | null;
  clientLastNamePaterno: string | null;
  clientLastNameMaterno: string | null;
  clientLegalName: string | null;
  clientRut: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientCelular: string | null;
  clientAddress: string | null;
  clientCommune: string | null;
  clientCity: string | null;
  clientRegion: string | null;
  // Compañía
  companyName: string | null;
  companyRut: string | null;
  companyLogoUrl: string | null;
  brokerCode: string | null;
  accountExecName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  // Producto / ramo
  productName: string | null;
  branchName: string | null;
  // Defaults
  insured: Party;
  beneficiary: Party;
  // Comisión
  commissionAffectPct: number | null;
  commissionExemptPct: number | null;
  // Items
  items: Array<{
    order: number;
    branchName: string;
    identification: string | null;
    glossNote: string | null;
    data: Record<string, unknown>;
    coverages: Array<{
      name: string;
      polCad: string | null;
      type: string;
      insuredAmount: number | null;
      isCommercialValue: boolean;
      taxRateAffect: number | null;
      taxRateExempt: number | null;
      premiumAffect: number | null;
      premiumExempt: number | null;
      premiumNet: number | null;
      ivaAmount: number | null;
      premiumGross: number | null;
      commissionAmount: number | null;
    }>;
  }>;
  totals: {
    insured: number;
    premiumAffect: number;
    premiumExempt: number;
    premiumNet: number;
    iva: number;
    premiumGross: number;
    commission: number;
  };
  paymentPlan: {
    option: string | null;
    installmentsCount: number;
    valorCuota: number | null;
    firstPaymentDate: Date | null;
    firstSignDate: Date | null;
    payerName: string | null;
    payerRut: string | null;
    documented: boolean;
  } | null;
};

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("es-CL") : "";
}

/**
 * Vigencia con fecha y hora (obs 10). La hora se guarda como "HH:mm" a nivel
 * propuesta; por defecto se asume mediodía (convención CL) si no se especificó.
 */
function fmtDateTime(d: Date | null, time: string | null): string {
  if (!d) return "—";
  const hhmm = (time && time.trim()) || "12:00";
  return `${d.toLocaleDateString("es-CL")} ${hhmm} hrs`;
}

function fmtN(v: number | null | undefined): string {
  if (v === null || v === undefined || v === 0) return "0,00";
  return v.toLocaleString("es-CL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const PAYMENT_OPTIONS = [
  { value: "CONTADO", label: "Contado" },
  { value: "AVISO_CUOTA", label: "Aviso Cuota" },
  { value: "CHEQUES", label: "Cheques" },
  { value: "PAC", label: "PAC" },
  { value: "PAT", label: "PAT" },
  { value: "CUPONERA", label: "Cuponera" },
  { value: "OTRO", label: "Otro" },
];

export function ProposalPdfTemplate({ data }: { data: PdfProposal }) {
  const totalDays =
    data.startDate && data.endDate
      ? Math.round(
          (data.endDate.getTime() - data.startDate.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header con corredora + logo compañía */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.brokerName}>{data.organizationName}</Text>
            <Text style={styles.brokerSub}>Corredora de seguros</Text>
          </View>
          <View style={styles.companyLogoBox}>
            {data.companyLogoUrl ? (
              <Image src={data.companyLogoUrl} style={styles.companyLogo} />
            ) : data.companyName ? (
              <Text style={{ fontSize: 10, fontWeight: "bold" }}>
                {data.companyName}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.title}>
          Propuesta de Seguro N° {data.proposalNumber}
        </Text>
        {data.productName && (
          <Text style={styles.subtitle}>{data.productName}</Text>
        )}

        {/* Tipo + fechas */}
        <Text style={styles.sectionBar}>Tipo y Vigencia</Text>
        <View style={styles.borderRow}>
          <View style={styles.cell6}>
            <Text style={styles.labelMuted}>Tipo</Text>
            <Text style={styles.labelBold}>
              {data.isRenovation ? "Renovación" : "Póliza Nueva"}
            </Text>
          </View>
          <View style={styles.cell6}>
            <Text style={styles.labelMuted}>Fecha</Text>
            <Text>{fmtDate(data.createdAt)}</Text>
          </View>
          <View style={styles.cell6}>
            <Text style={styles.labelMuted}>N° Póliza Anterior</Text>
            <Text>{data.previousPolicyNumber ?? "—"}</Text>
          </View>
          <View style={styles.cell6}>
            <Text style={styles.labelMuted}>N° Propuesta</Text>
            <Text style={styles.labelBold}>{data.proposalNumber}</Text>
          </View>
          <View style={styles.cell3}>
            <Text style={styles.labelMuted}>Moneda</Text>
            <Text>{data.currency}</Text>
          </View>
        </View>
        <View style={styles.borderRow}>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Desde</Text>
            <Text>{fmtDateTime(data.startDate, data.startTime)}</Text>
          </View>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Hasta</Text>
            <Text>
              {fmtDateTime(data.endDate, data.endTime)}
              {totalDays !== null ? ` (${totalDays} días)` : ""}
            </Text>
          </View>
        </View>

        {/* Antecedentes Compañía */}
        <Text style={styles.sectionBar}>Antecedentes Compañía</Text>
        <View style={styles.borderRow}>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Según Cotización</Text>
            <Text>{data.quotationNumberRef ?? "—"}</Text>
          </View>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Ejecutivo Compañía</Text>
            <Text>{data.contactName ?? "—"}</Text>
          </View>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Propuesta Compañía</Text>
            <Text>—</Text>
          </View>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Cantidad Ítems</Text>
            <Text>{data.items.length}</Text>
          </View>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Ramo</Text>
            <Text>{data.branchName ?? "—"}</Text>
          </View>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Producto</Text>
            <Text>{data.productName ?? "—"}</Text>
          </View>
        </View>

        {/* Corredor / Ejecutivo */}
        <Text style={styles.sectionBar}>
          Identificación Corredor / Ejecutivo Cuentas
        </Text>
        <View style={styles.borderRow}>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Nombre Corredor</Text>
            <Text style={styles.labelBold}>{data.organizationName}</Text>
          </View>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Código Agencia/Agente</Text>
            <Text>{data.brokerCode ?? "—"}</Text>
          </View>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Ejecutivo de Cuentas</Text>
            <Text>{data.accountExecName ?? "—"}</Text>
          </View>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Comisión Corredor</Text>
            <Text>
              Afecto: {fmtPct(data.commissionAffectPct)} · Exento:{" "}
              {fmtPct(data.commissionExemptPct)}
            </Text>
          </View>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Email Envío</Text>
            <Text>{data.contactEmail ?? "—"}</Text>
          </View>
        </View>

        {/* Observaciones */}
        {data.observations && (
          <>
            <Text style={styles.sectionBar}>Observaciones</Text>
            <Text style={styles.observations}>{data.observations}</Text>
          </>
        )}

        {/* Contratante */}
        <Text style={styles.sectionBar}>Identificación Contratante</Text>
        <View style={styles.borderRow}>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>Razón Social o Nombre Completo</Text>
            <Text style={styles.labelBold}>
              {data.clientLegalName ?? data.clientName}
            </Text>
          </View>
          <View style={styles.cell2}>
            <Text style={styles.labelMuted}>RUT Contratante</Text>
            <Text>{data.clientRut ?? "—"}</Text>
          </View>
          {data.clientType === "PERSONA" && (
            <>
              <View style={styles.cell3}>
                <Text style={styles.labelMuted}>Apellido Paterno</Text>
                <Text>{data.clientLastNamePaterno ?? "—"}</Text>
              </View>
              <View style={styles.cell3}>
                <Text style={styles.labelMuted}>Apellido Materno</Text>
                <Text>{data.clientLastNameMaterno ?? "—"}</Text>
              </View>
              <View style={styles.cell3}>
                <Text style={styles.labelMuted}>Nombres</Text>
                <Text>{data.clientFirstName ?? "—"}</Text>
              </View>
            </>
          )}
          <View style={styles.cell3}>
            <Text style={styles.labelMuted}>Email</Text>
            <Text>{data.clientEmail ?? "—"}</Text>
          </View>
          <View style={styles.cell3}>
            <Text style={styles.labelMuted}>Teléfono</Text>
            <Text>{data.clientPhone ?? "—"}</Text>
          </View>
          <View style={styles.cell3}>
            <Text style={styles.labelMuted}>Celular</Text>
            <Text>{data.clientCelular ?? "—"}</Text>
          </View>
          <View style={styles.cell3}>
            <Text style={styles.labelMuted}>Dirección</Text>
            <Text>{data.clientAddress ?? "—"}</Text>
          </View>
          <View style={styles.cell6}>
            <Text style={styles.labelMuted}>Comuna</Text>
            <Text>{data.clientCommune ?? "—"}</Text>
          </View>
          <View style={styles.cell6}>
            <Text style={styles.labelMuted}>Ciudad</Text>
            <Text>{data.clientCity ?? "—"}</Text>
          </View>
          <View style={styles.cell3}>
            <Text style={styles.labelMuted}>Región</Text>
            <Text>{data.clientRegion ?? "—"}</Text>
          </View>
        </View>

        {/* Ítems */}
        {data.items.map((item, idx) => (
          <View key={idx} style={{ marginTop: 6 }}>
            <Text style={styles.sectionBar}>Ítem {idx + 1} · {item.branchName}</Text>
            <View style={styles.borderRow}>
              {item.identification && (
                <View style={styles.cell3}>
                  <Text style={styles.labelMuted}>Identificación</Text>
                  <Text>{item.identification}</Text>
                </View>
              )}
              {Object.entries(item.data)
                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                .map(([key, val]) => (
                  <View key={key} style={styles.cell3}>
                    <Text style={styles.labelMuted}>
                      {key.replace(/_/g, " ")}
                    </Text>
                    <Text>{String(val)}</Text>
                  </View>
                ))}
              {item.glossNote && (
                <View style={styles.cell2}>
                  <Text style={styles.labelMuted}>Comentarios</Text>
                  <Text>{item.glossNote}</Text>
                </View>
              )}
            </View>

            {/* Asegurado / Beneficiario por ítem (defaults de carátula) */}
            <View style={{ flexDirection: "row", marginTop: 2 }}>
              <View style={{ width: "50%", paddingRight: 4 }}>
                <Text
                  style={{ fontSize: 8, fontWeight: "bold", color: "white", backgroundColor: COLOR_HEADER_BG, padding: 2 }}
                >
                  Asegurado
                </Text>
                <Text style={{ fontSize: 8, padding: 2 }}>
                  {data.insured.name}
                  {data.insured.rut ? ` · ${data.insured.rut}` : ""}
                </Text>
                {(data.insured.address || data.insured.commune) && (
                  <Text style={{ fontSize: 7, padding: 2, color: COLOR_MUTED }}>
                    {[data.insured.address, data.insured.commune, data.insured.region]
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                )}
              </View>
              <View style={{ width: "50%" }}>
                <Text
                  style={{ fontSize: 8, fontWeight: "bold", color: "white", backgroundColor: COLOR_HEADER_BG, padding: 2 }}
                >
                  Beneficiario
                </Text>
                <Text style={{ fontSize: 8, padding: 2 }}>
                  {data.beneficiary.name}
                  {data.beneficiary.rut ? ` · ${data.beneficiary.rut}` : ""}
                </Text>
                {(data.beneficiary.address || data.beneficiary.commune) && (
                  <Text style={{ fontSize: 7, padding: 2, color: COLOR_MUTED }}>
                    {[data.beneficiary.address, data.beneficiary.commune, data.beneficiary.region]
                      .filter(Boolean)
                      .join(", ")}
                  </Text>
                )}
              </View>
            </View>

            {/* Coberturas del ítem */}
            {item.coverages.length > 0 && (
              <View style={{ marginTop: 4 }}>
                <Text
                  style={{
                    fontSize: 8,
                    fontWeight: "bold",
                    color: "white",
                    backgroundColor: COLOR_HEADER_BG,
                    padding: 2,
                  }}
                >
                  Coberturas Ítem {idx + 1}
                </Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.th, { width: "24%" }]}>Cobertura</Text>
                  <Text style={[styles.th, { width: "11%", textAlign: "right" }]}>
                    Mto Aseg
                  </Text>
                  <Text style={[styles.th, { width: "8%", textAlign: "right" }]}>
                    T.Afe
                  </Text>
                  <Text style={[styles.th, { width: "8%", textAlign: "right" }]}>
                    T.Exe
                  </Text>
                  <Text style={[styles.th, { width: "11%", textAlign: "right" }]}>
                    P.Afecta
                  </Text>
                  <Text style={[styles.th, { width: "11%", textAlign: "right" }]}>
                    P.Exenta
                  </Text>
                  <Text style={[styles.th, { width: "9%", textAlign: "right" }]}>
                    IVA
                  </Text>
                  <Text style={[styles.th, { width: "9%", textAlign: "right" }]}>
                    Bruta
                  </Text>
                  <Text style={[styles.th, { width: "9%", textAlign: "right" }]}>
                    Comisión
                  </Text>
                </View>
                {item.coverages.map((c, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.td, { width: "24%" }]}>
                      {c.name}
                      {c.polCad ? ` (${c.polCad})` : ""}
                    </Text>
                    <Text style={[styles.td, { width: "11%", textAlign: "right" }]}>
                      {c.isCommercialValue ? "Valor Com." : fmtN(c.insuredAmount)}
                    </Text>
                    <Text style={[styles.td, { width: "8%", textAlign: "right" }]}>
                      {fmtRate(c.taxRateAffect)}
                    </Text>
                    <Text style={[styles.td, { width: "8%", textAlign: "right" }]}>
                      {fmtRate(c.taxRateExempt)}
                    </Text>
                    <Text style={[styles.td, { width: "11%", textAlign: "right" }]}>
                      {fmtN(c.premiumAffect)}
                    </Text>
                    <Text style={[styles.td, { width: "11%", textAlign: "right" }]}>
                      {fmtN(c.premiumExempt)}
                    </Text>
                    <Text style={[styles.td, { width: "9%", textAlign: "right" }]}>
                      {fmtN(c.ivaAmount)}
                    </Text>
                    <Text style={[styles.td, { width: "9%", textAlign: "right" }]}>
                      {fmtN(c.premiumGross)}
                    </Text>
                    <Text style={[styles.td, { width: "9%", textAlign: "right" }]}>
                      {fmtN(c.commissionAmount)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Totales Póliza */}
        <Text style={styles.sectionBar}>Totales Póliza</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: "16%", textAlign: "right" }]}>
            Mto Aseg
          </Text>
          <Text style={[styles.th, { width: "17%", textAlign: "right" }]}>
            Prima Neta Afecta
          </Text>
          <Text style={[styles.th, { width: "17%", textAlign: "right" }]}>
            Prima Neta Exenta
          </Text>
          <Text style={[styles.th, { width: "12%", textAlign: "right" }]}>
            Total
          </Text>
          <Text style={[styles.th, { width: "12%", textAlign: "right" }]}>
            IVA
          </Text>
          <Text style={[styles.th, { width: "13%", textAlign: "right" }]}>
            Prima Bruta
          </Text>
          <Text style={[styles.th, { width: "13%", textAlign: "right" }]}>
            Comisión Total
          </Text>
        </View>
        <View style={styles.tableFooter}>
          <Text style={[styles.td, { width: "16%", textAlign: "right" }]}>
            {fmtN(data.totals.insured)}
          </Text>
          <Text style={[styles.td, { width: "17%", textAlign: "right" }]}>
            {fmtN(data.totals.premiumAffect)}
          </Text>
          <Text style={[styles.td, { width: "17%", textAlign: "right" }]}>
            {fmtN(data.totals.premiumExempt)}
          </Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>
            {fmtN(data.totals.premiumNet)}
          </Text>
          <Text style={[styles.td, { width: "12%", textAlign: "right" }]}>
            {fmtN(data.totals.iva)}
          </Text>
          <Text style={[styles.td, { width: "13%", textAlign: "right" }]}>
            {fmtN(data.totals.premiumGross)}
          </Text>
          <Text style={[styles.td, { width: "13%", textAlign: "right" }]}>
            {fmtN(data.totals.commission)}
          </Text>
        </View>

        {/* Forma de Pago */}
        <Text style={styles.sectionBar}>Forma de Pago</Text>
        <View style={styles.paymentBox}>
          {PAYMENT_OPTIONS.map((opt) => (
            <Text key={opt.value} style={styles.paymentOpt}>
              {opt.label}{" "}
              {data.paymentPlan?.option === opt.value ? "[X]" : "[ ]"}
            </Text>
          ))}
        </View>
        {data.paymentPlan && (
          <View style={styles.borderRow}>
            <View style={styles.cell3}>
              <Text style={styles.labelMuted}>Pagador</Text>
              <Text>{data.paymentPlan.payerName ?? "—"}</Text>
            </View>
            <View style={styles.cell3}>
              <Text style={styles.labelMuted}>RUT</Text>
              <Text>{data.paymentPlan.payerRut ?? "—"}</Text>
            </View>
            <View style={styles.cell3}>
              <Text style={styles.labelMuted}>Cuotas</Text>
              <Text>{data.paymentPlan.installmentsCount}</Text>
            </View>
            <View style={styles.cell3}>
              <Text style={styles.labelMuted}>Valor cuota</Text>
              <Text>{fmtN(data.paymentPlan.valorCuota)}</Text>
            </View>
            <View style={styles.cell3}>
              <Text style={styles.labelMuted}>Fecha Primera Cuota</Text>
              <Text>{fmtDate(data.paymentPlan.firstPaymentDate)}</Text>
            </View>
            <View style={styles.cell3}>
              <Text style={styles.labelMuted}>Fecha Firma PP</Text>
              <Text>{fmtDate(data.paymentPlan.firstSignDate)}</Text>
            </View>
          </View>
        )}

        {/* Firmas */}
        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <View style={styles.signLine}>
              <Text>Firma Corredor</Text>
            </View>
          </View>
          <View style={styles.signBox}>
            <View style={styles.signLine}>
              <Text>Firma Cliente</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {data.organizationName} · Con la emisión de la presente propuesta, no
          se obtiene cobertura alguna al riesgo que se procura asegurar. La
          cobertura comienza a regir únicamente a partir del momento en que esta
          propuesta sea aceptada por el asegurador y se inicie la vigencia de la
          póliza.
        </Text>
      </Page>
    </Document>
  );
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${v.toLocaleString("es-CL", { maximumFractionDigits: 3 })}%`;
}

function fmtRate(v: number | null): string {
  if (v === null || v === 0) return "0";
  return v.toLocaleString("es-CL", { maximumFractionDigits: 4 });
}

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
    paddingBottom: 70,
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
  brokerName: { fontSize: 11, fontWeight: "bold", color: COLOR_PRIMARY },
  brokerSub: { fontSize: 8, color: COLOR_MUTED },
  companyLogoBox: { width: 130, height: 40, alignItems: "flex-end" },
  companyLogo: { maxWidth: 130, maxHeight: 40, objectFit: "contain" },
  title: { textAlign: "center", fontSize: 14, fontWeight: "bold", marginTop: 6 },
  subtitle: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 8,
  },
  gridHeader: { flexDirection: "row", backgroundColor: COLOR_HEADER_BG },
  gridHeaderCell: {
    color: "white",
    fontSize: 9,
    fontWeight: "bold",
    paddingVertical: 3,
    paddingHorizontal: 4,
    textAlign: "center",
    borderRight: 1,
    borderRightColor: "white",
  },
  gridRow: {
    flexDirection: "row",
    backgroundColor: COLOR_LIGHT_BG,
    marginBottom: 4,
  },
  gridCell: {
    fontSize: 8,
    paddingVertical: 3,
    paddingHorizontal: 4,
    textAlign: "center",
  },
  sectionBar: {
    backgroundColor: COLOR_HEADER_BG,
    color: "white",
    paddingVertical: 3,
    paddingHorizontal: 6,
    fontSize: 9,
    fontWeight: "bold",
    marginTop: 8,
  },
  box: { backgroundColor: COLOR_LIGHT_BG, paddingVertical: 3 },
  row: { flexDirection: "row", flexWrap: "wrap" },
  cell3: { width: "33.33%", paddingHorizontal: 4, paddingVertical: 2 },
  cell2: { width: "50%", paddingHorizontal: 4, paddingVertical: 2 },
  labelBold: { fontWeight: "bold", fontSize: 8 },
  detail: {
    backgroundColor: COLOR_LIGHT_BG,
    paddingHorizontal: 4,
    paddingVertical: 4,
    fontSize: 8,
    lineHeight: 1.35,
  },
  signRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 90,
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
});

export type PdfEndorsement = {
  kind: "ENDOSO";
  proposalNumber: string;
  createdAt: Date;
  endorsementTypeLabel: string;
  policyNumber: string | null;
  branchOfficeName: string | null;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  currencyLabel: string;
  branchName: string | null;
  productName: string | null;
  organizationName: string;
  organizationRut: string | null;
  brokerCode: string | null;
  accountExecName: string | null;
  commissionPct: number | null;
  companyName: string | null;
  companyLogoUrl: string | null;
  clientName: string;
  clientRut: string | null;
  detail: string;
};

function fmtDate(d: Date | null): string {
  return d ? d.toLocaleDateString("es-CL") : "—";
}

function fmtVigencia(prefix: string, d: Date | null, time: string | null): string {
  if (!d) return "—";
  const hhmm = (time && time.trim()) || "12:00";
  return `${prefix} las ${hhmm} hrs del ${fmtDate(d)}`;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toLocaleString("es-CL", { maximumFractionDigits: 3 })}%`;
}

function Grid({
  headers,
  values,
  widths,
}: {
  headers: string[];
  values: string[];
  widths: string[];
}) {
  return (
    <View wrap={false}>
      <View style={styles.gridHeader}>
        {headers.map((h, i) => (
          <Text key={h} style={[styles.gridHeaderCell, { width: widths[i] }]}>
            {h}
          </Text>
        ))}
      </View>
      <View style={styles.gridRow}>
        {values.map((v, i) => (
          <Text key={headers[i]} style={[styles.gridCell, { width: widths[i] }]}>
            {v}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * "Solicitud de Endoso": PDF de la propuesta de endoso que se envía a la
 * compañía (mismo formato que usaba la corredora en Brokeris).
 */
export function EndorsementPdfTemplate({ data }: { data: PdfEndorsement }) {
  const widths = ["18%", "18%", "20%", "20%", "24%"];
  return (
    <Document>
      <Page size="A4" style={styles.page}>
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

        <Text style={styles.title}>Solicitud de Endoso</Text>
        <Text style={styles.subtitle}>{data.endorsementTypeLabel}</Text>

        <Grid
          headers={["Tipo Endoso", "Fecha", "Sucursal", "N° Póliza", "N° Propuesta"]}
          values={[
            data.endorsementTypeLabel,
            fmtDate(data.createdAt),
            data.branchOfficeName ?? "",
            data.policyNumber ?? "—",
            data.proposalNumber,
          ]}
          widths={widths}
        />
        <Grid
          headers={["Inicio Endoso", "Fin Endoso", "Moneda", "Ramo", "Producto"]}
          values={[
            fmtVigencia("Desde", data.startDate, data.startTime),
            fmtVigencia("Hasta", data.endDate, data.endTime),
            data.currencyLabel,
            data.branchName ?? "—",
            data.productName ?? "—",
          ]}
          widths={widths}
        />

        <Text style={styles.sectionBar}>
          Identificación Corredor / Ejecutivo Cuentas
        </Text>
        <View style={[styles.box, styles.row]}>
          <View style={{ width: "66.66%", paddingHorizontal: 4, paddingVertical: 2 }}>
            <Text style={styles.labelBold}>Nombre Corredor</Text>
            <Text>{data.organizationName}</Text>
          </View>
          <View style={styles.cell3}>
            <Text style={styles.labelBold}>Rut Corredor</Text>
            <Text>{data.organizationRut ?? "—"}</Text>
          </View>
          <View style={styles.cell3}>
            <Text style={styles.labelBold}>Código Agencia/Agente</Text>
            <Text>{data.brokerCode ?? ""}</Text>
          </View>
          <View style={styles.cell3}>
            <Text style={styles.labelBold}>Nombre Ejecutivo de Cuentas</Text>
            <Text>{data.accountExecName ?? "—"}</Text>
          </View>
          <View style={styles.cell3}>
            <Text style={styles.labelBold}>Comisión Corredor</Text>
            <Text>{fmtPct(data.commissionPct)}</Text>
          </View>
        </View>

        <Text style={styles.sectionBar}>Identificación Contratante</Text>
        <View style={[styles.box, styles.row]}>
          <View style={{ width: "60%", paddingHorizontal: 4, paddingVertical: 2 }}>
            <Text style={styles.labelBold}>Razón Social o Nombre Completo</Text>
            <Text>{data.clientName}</Text>
          </View>
          <View style={{ width: "40%", paddingHorizontal: 4, paddingVertical: 2 }}>
            <Text style={styles.labelBold}>Rut Contratante</Text>
            <Text>{data.clientRut ?? "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionBar}>Detalle del Endoso</Text>
        <Text style={styles.detail}>{data.detail}</Text>

        <View style={styles.signRow} wrap={false}>
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
          {data.accountExecName ? `${data.accountExecName}\n` : ""}
          {data.organizationName}
          {"\n"}Con la emisión de la presente propuesta, no se obtiene cobertura
          alguna al riesgo que se procura asegurar. La cobertura comienza a regir
          únicamente a partir del momento en que esta propuesta sea aceptada por
          el asegurador y se inicie la vigencia de la póliza.
        </Text>
      </Page>
    </Document>
  );
}

// Seed de catálogos globales: BranchType + BranchFieldSchema + GlobalInsuranceCompany
// Idempotente: usa upsert por clave natural (key/name).

import { Prisma, type PrismaClient } from "@prisma/client";

type FieldDef = {
  fieldKey: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea";
  required?: boolean;
  options?: { value: string; label: string }[];
  helpText?: string;
};

type BranchDef = {
  key: string;
  name: string;
  category: "GENERALES" | "VIDA_SALUD";
  order: number;
  fields: FieldDef[];
};

// Conjuntos de campos reutilizables entre ramos similares.
const FIELDS_INMUEBLE: FieldDef[] = [
  { fieldKey: "direccion", label: "Dirección", type: "text", required: true },
  { fieldKey: "comuna", label: "Comuna", type: "text" },
  { fieldKey: "ciudad", label: "Ciudad", type: "text" },
  {
    fieldKey: "tipo_inmueble",
    label: "Tipo de Inmueble",
    type: "select",
    options: [
      { value: "CASA", label: "Casa" },
      { value: "DEPARTAMENTO", label: "Departamento" },
      { value: "LOCAL", label: "Local" },
      { value: "FABRICA", label: "Fábrica" },
      { value: "EDIFICIO", label: "Edificio" },
      { value: "CENTRO_COMERCIAL", label: "Centro Comercial" },
    ],
  },
  {
    fieldKey: "uso",
    label: "Uso",
    type: "select",
    options: [
      { value: "HABITACIONAL", label: "Habitacional" },
      { value: "COMERCIAL", label: "Comercial" },
    ],
  },
  { fieldKey: "pisos", label: "Pisos", type: "number" },
  {
    fieldKey: "zona",
    label: "Zona",
    type: "select",
    options: [
      { value: "URBANA", label: "Urbana" },
      { value: "RURAL", label: "Rural" },
    ],
  },
  { fieldKey: "tipo_construccion", label: "Tipo de construcción", type: "text" },
  { fieldKey: "anio_construccion", label: "Año de construcción", type: "number" },
  { fieldKey: "identificacion", label: "Identificación", type: "text" },
  { fieldKey: "descripcion_materia", label: "Descripción Materia Asegurada", type: "textarea" },
];

const FIELDS_PERSONA: FieldDef[] = [
  { fieldKey: "rut_asegurado", label: "RUT Asegurado", type: "text", required: true },
  { fieldKey: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date" },
  { fieldKey: "nombre", label: "Nombre", type: "text", required: true },
  { fieldKey: "apellido_paterno", label: "Apellido Paterno", type: "text" },
  { fieldKey: "apellido_materno", label: "Apellido Materno", type: "text" },
  { fieldKey: "identificacion", label: "Identificación", type: "text" },
];

const FIELDS_GENERICO_RIESGO: FieldDef[] = [
  { fieldKey: "descripcion_riesgo", label: "Descripción del riesgo", type: "textarea", required: true },
  { fieldKey: "identificacion", label: "Identificación", type: "text" },
  { fieldKey: "referencia", label: "Referencia", type: "text" },
];

const FIELDS_VEHICULO: FieldDef[] = [
  { fieldKey: "patente", label: "Patente", type: "text", required: true },
  { fieldKey: "anio", label: "Año", type: "number" },
  { fieldKey: "tipo", label: "Tipo", type: "text" },
  {
    fieldKey: "uso",
    label: "Uso",
    type: "select",
    options: [
      { value: "PARTICULAR", label: "Particular" },
      { value: "COMERCIAL", label: "Comercial" },
    ],
  },
  { fieldKey: "marca", label: "Marca", type: "text" },
  { fieldKey: "modelo", label: "Modelo", type: "text" },
  { fieldKey: "version", label: "Versión", type: "text" },
  { fieldKey: "n_serie", label: "N° de serie", type: "text" },
  { fieldKey: "deducible", label: "Deducible", type: "text" },
  { fieldKey: "n_motor", label: "N° de motor", type: "text" },
  { fieldKey: "n_chasis", label: "N° de chasis", type: "text" },
  { fieldKey: "identificacion", label: "Identificación", type: "text" },
];

const BRANCHES: BranchDef[] = [
  // === GENERALES ===
  { key: "incendio", name: "Incendio", category: "GENERALES", order: 10, fields: FIELDS_INMUEBLE },
  {
    key: "todo_riesgo_construccion",
    name: "Todo Riesgo Construcción y Montaje",
    category: "GENERALES",
    order: 20,
    fields: FIELDS_INMUEBLE,
  },
  {
    key: "todo_riesgo_bienes",
    name: "Todo Riesgo de Bienes Físicos",
    category: "GENERALES",
    order: 30,
    fields: FIELDS_INMUEBLE,
  },
  {
    key: "accidentes_personales_nominados",
    name: "Accidentes Personales Nominados",
    category: "GENERALES",
    order: 40,
    fields: FIELDS_PERSONA,
  },
  {
    key: "accidentes_personales_innominados",
    name: "Accidentes Personales Innominados",
    category: "GENERALES",
    order: 50,
    fields: FIELDS_GENERICO_RIESGO,
  },
  {
    key: "responsabilidad_civil",
    name: "Responsabilidad Civil",
    category: "GENERALES",
    order: 60,
    fields: FIELDS_GENERICO_RIESGO,
  },
  {
    key: "garantia",
    name: "Garantía",
    category: "GENERALES",
    order: 70,
    fields: FIELDS_GENERICO_RIESGO,
  },
  {
    key: "equipo_movil_individualizado",
    name: "Equipo Móvil Individualizado",
    category: "GENERALES",
    order: 80,
    fields: FIELDS_VEHICULO,
  },
  {
    key: "vehiculos_motorizados",
    name: "Vehículos Motorizados",
    category: "GENERALES",
    order: 90,
    fields: FIELDS_VEHICULO,
  },
  {
    key: "soap",
    name: "SOAP",
    category: "GENERALES",
    order: 100,
    fields: FIELDS_VEHICULO,
  },
  {
    key: "equipo_movil_general",
    name: "Equipo Móvil General",
    category: "GENERALES",
    order: 110,
    fields: [
      { fieldKey: "descripcion_riesgo", label: "Descripción del riesgo", type: "textarea", required: true },
      { fieldKey: "tipo", label: "Tipo", type: "text" },
      { fieldKey: "anio", label: "Año", type: "number" },
      { fieldKey: "uso", label: "Uso", type: "text" },
      { fieldKey: "marca", label: "Marca", type: "text" },
      { fieldKey: "modelo", label: "Modelo", type: "text" },
    ],
  },
  {
    key: "transporte",
    name: "Transporte",
    category: "GENERALES",
    order: 120,
    fields: [
      { fieldKey: "n_operacion", label: "N° de operación", type: "text" },
      { fieldKey: "descripcion_riesgo", label: "Descripción del riesgo", type: "textarea" },
      {
        fieldKey: "tipo_transporte",
        label: "Tipo de transporte",
        type: "select",
        options: [
          { value: "NACIONAL", label: "Nacional" },
          { value: "INTERNACIONAL", label: "Internacional" },
          { value: "NACIONAL_INTERNACIONAL", label: "Nacional e Internacional" },
        ],
      },
    ],
  },
  {
    key: "casco_maritimo",
    name: "Casco Marítimo",
    category: "GENERALES",
    order: 130,
    fields: [
      { fieldKey: "nombre_nave", label: "Nombre de la nave", type: "text", required: true },
      {
        fieldKey: "tipo_nave",
        label: "Tipo de nave",
        type: "select",
        options: [
          { value: "PESQUERO_ARTESANAL", label: "Pesquero artesanal" },
          { value: "YATE", label: "Yate" },
          { value: "VELERO", label: "Velero" },
          { value: "LANCHA", label: "Lancha" },
          { value: "BOTE", label: "Bote" },
          { value: "MOTO_AGUA", label: "Moto de agua" },
          { value: "CATAMARAN", label: "Catamarán" },
          { value: "REMOLCADOR", label: "Remolcador" },
          { value: "BUQUE_MOTOR", label: "Buque motor" },
          { value: "FERRI", label: "Ferri" },
          { value: "BARCAZA", label: "Barcaza" },
          { value: "RO_RO", label: "Ro-Ro" },
          { value: "FIREBOAT", label: "Fireboat" },
          { value: "PONTON", label: "Pontón" },
          { value: "ARTEFACTO_NAVAL", label: "Artefacto naval" },
          { value: "PLATAFORMA", label: "Plataforma" },
          { value: "DIQUE_FLOTANTE", label: "Dique flotante" },
        ],
      },
      {
        fieldKey: "uso",
        label: "Uso",
        type: "select",
        options: [
          { value: "RECREACIONAL", label: "Recreacional" },
          { value: "PLACER", label: "Placer" },
          { value: "PARTICULAR", label: "Particular" },
          { value: "TRANSPORTE_CARGA", label: "Transporte de carga" },
          { value: "TRANSPORTE_PASAJERO", label: "Transporte de pasajero" },
        ],
      },
      {
        fieldKey: "material",
        label: "Material",
        type: "select",
        options: [
          { value: "FIBRA_VIDRIO", label: "Fibra de vidrio" },
          { value: "MADERA", label: "Madera" },
          { value: "FIERRO", label: "Fierro" },
          { value: "ACERO", label: "Acero" },
          { value: "HORMIGON", label: "Hormigón" },
        ],
      },
      { fieldKey: "anio_construccion", label: "Año de construcción", type: "number" },
      { fieldKey: "eslora", label: "Eslora", type: "text" },
      { fieldKey: "manga", label: "Manga", type: "text" },
      { fieldKey: "puntal", label: "Puntal", type: "text" },
      { fieldKey: "trg", label: "TRG (tonelaje de registro grueso)", type: "text" },
      { fieldKey: "matricula", label: "Matrícula", type: "text" },
      { fieldKey: "puerto_base", label: "Puerto Base", type: "text" },
    ],
  },
  {
    key: "casco_aereo",
    name: "Casco Aéreo",
    category: "GENERALES",
    order: 140,
    fields: [
      {
        fieldKey: "tipo_aeronave",
        label: "Tipo de aeronave",
        type: "select",
        options: [
          { value: "AVIONETA", label: "Avioneta" },
          { value: "AIRBUS", label: "Airbus" },
          { value: "AVION", label: "Avión" },
          { value: "HELICOPTERO", label: "Helicóptero" },
          { value: "GLOBO_AEROSTATICO", label: "Globo aerostático" },
          { value: "DRON", label: "Dron" },
          { value: "JET", label: "Jet" },
        ],
      },
      {
        fieldKey: "uso",
        label: "Uso",
        type: "select",
        options: [
          { value: "COMERCIAL", label: "Comercial" },
          { value: "PRIVADO", label: "Privado" },
        ],
      },
      { fieldKey: "anio", label: "Año", type: "number" },
      { fieldKey: "matricula", label: "Matrícula", type: "text" },
      { fieldKey: "zona_operacion", label: "Zona de operación", type: "text" },
      { fieldKey: "marca", label: "Marca", type: "text" },
      { fieldKey: "modelo", label: "Modelo", type: "text" },
      { fieldKey: "n_serie", label: "N° de serie", type: "text" },
    ],
  },

  // === VIDA Y SALUD ===
  {
    key: "vida_salud",
    name: "Vida y Salud",
    category: "VIDA_SALUD",
    order: 200,
    fields: FIELDS_PERSONA,
  },
];

const GLOBAL_COMPANIES: {
  name: string;
  legalName?: string;
  rut?: string;
  url?: string;
  isLife?: boolean;
}[] = [
  { name: "BCI Seguros", legalName: "BCI Seguros Generales S.A.", rut: "96.519.800-8", url: "https://www.bciseguros.cl" },
  { name: "Zurich Chile", legalName: "Zurich Compañía de Seguros Generales S.A.", rut: "97.023.000-9", url: "https://www.zurich.cl" },
  { name: "HDI Seguros", legalName: "HDI Seguros S.A.", rut: "99.291.000-K", url: "https://www.hdi.cl" },
  { name: "Sura Chile", legalName: "Seguros Sura S.A.", rut: "99.018.000-3", url: "https://www.segurossura.cl" },
  { name: "Chubb Seguros", legalName: "Chubb Seguros Chile S.A.", rut: "99.225.000-8", url: "https://www.chubb.com/cl" },
  { name: "Renta Nacional", legalName: "Renta Nacional Compañía de Seguros Generales S.A.", rut: "96.654.180-6", url: "https://www.rentanacional.cl" },
  { name: "Reale Seguros", legalName: "Reale Chile Seguros Generales S.A.", rut: "76.661.580-K", url: "https://www.realeseguros.cl" },
  { name: "Aspor Seguros", legalName: "Aspor Chile Compañía de Seguros Generales S.A.", rut: "76.421.024-K", url: "https://www.asporseguros.cl" },
  { name: "FID Chile", legalName: "FID Chile Seguros Generales S.A.", rut: "76.418.420-6", url: "https://www.fidchile.cl" },
  { name: "Consorcio Seguros", legalName: "Consorcio Nacional de Seguros S.A.", rut: "99.012.000-5", url: "https://www.consorcio.cl", isLife: true },
  { name: "MetLife", legalName: "MetLife Chile Seguros de Vida S.A.", rut: "99.299.000-K", url: "https://www.metlife.cl", isLife: true },
  { name: "Mapfre Seguros", legalName: "Mapfre Compañía de Seguros Generales de Chile S.A.", rut: "99.062.000-4", url: "https://www.mapfre.cl" },
  { name: "Liberty Seguros", legalName: "Liberty Compañía de Seguros Generales S.A.", rut: "99.140.000-4", url: "https://www.liberty.cl" },
];

export async function seedGlobals(prisma: PrismaClient) {
  // Currencies adicionales: UD (Unidad de Desarrollo) y USD_OBS (Dólar Observado).
  const EXTRA_CURRENCIES = [
    { code: "UD", name: "Unidad de Desarrollo", symbol: "UD" },
    { code: "USD_OBS", name: "Dólar Observado", symbol: "USD obs" },
  ];
  for (const c of EXTRA_CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: { name: c.name, symbol: c.symbol },
      create: c,
    });
  }

  // Limpieza de campos legacy que ya no están en el seed.
  // - "otro_modelo": se eliminó al introducir el autocompletado de modelo.
  // - "comentarios": se eliminó del JSON porque ya tenemos
  //   `ProposalItem.glossNote` como columna dedicada (evita pedir glosa dos
  //   veces en el formulario de ítem).
  await prisma.branchFieldSchema.deleteMany({
    where: { fieldKey: { in: ["otro_modelo", "comentarios"] } },
  });

  // BranchType + BranchFieldSchema
  for (const b of BRANCHES) {
    const branchType = await prisma.branchType.upsert({
      where: { key: b.key },
      update: { name: b.name, category: b.category, order: b.order, active: true },
      create: { key: b.key, name: b.name, category: b.category, order: b.order },
    });
    for (let i = 0; i < b.fields.length; i++) {
      const f = b.fields[i];
      await prisma.branchFieldSchema.upsert({
        where: { branchTypeId_fieldKey: { branchTypeId: branchType.id, fieldKey: f.fieldKey } },
        update: {
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          order: i,
          options: f.options ? (f.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          helpText: f.helpText ?? null,
        },
        create: {
          branchTypeId: branchType.id,
          fieldKey: f.fieldKey,
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          order: i,
          options: f.options ? (f.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          helpText: f.helpText ?? null,
        },
      });
    }
  }

  // GlobalInsuranceCompany
  for (const c of GLOBAL_COMPANIES) {
    await prisma.globalInsuranceCompany.upsert({
      where: { name: c.name },
      update: {
        legalName: c.legalName ?? null,
        rut: c.rut ?? null,
        url: c.url ?? null,
        isLife: c.isLife ?? false,
      },
      create: {
        name: c.name,
        legalName: c.legalName ?? null,
        rut: c.rut ?? null,
        url: c.url ?? null,
        isLife: c.isLife ?? false,
      },
    });
  }
}

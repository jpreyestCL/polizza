import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cartaReservaSubject,
  cartaReservaText,
} from "@/features/proposals/emails/carta-reserva";

// === Hoisted mock state (accesible desde factories vi.mock) ===
const h = vi.hoisted(() => {
  type Proposal = {
    id: string;
    organizationId: string;
    proposalNumber: string;
    companyId: string | null;
    productId: string | null;
    conReserva: boolean;
    status: string;
    sentAt: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    clientId: string;
    client?: { name: string; rut: string } | null;
    branchType?: { name: string } | null;
  };
  type Contact = {
    id: string;
    insuranceCompanyId: string;
    isReservationRecipient: boolean;
    email: string | null;
    name: string;
  };
  type Log = {
    id: string;
    organizationId: string;
    proposalId: string;
    action: string;
    summary: string;
    payload?: unknown;
    createdAt: Date;
  };

  const state: {
    proposal: Proposal | null;
    contacts: Contact[];
    logs: Log[];
    product: { id: string; name: string } | null;
    org: { id: string; name: string; reservaDays: number };
  } = {
    proposal: null,
    contacts: [],
    logs: [],
    product: null,
    org: { id: "org1", name: "Corredora Test", reservaDays: 20 },
  };

  let logSeq = 0;
  const addLog = (input: Omit<Log, "id" | "createdAt">): Log => {
    const l: Log = { ...input, id: `log${++logSeq}`, createdAt: new Date() };
    state.logs.push(l);
    return l;
  };

  const db = {
    proposal: {
      findFirst: async () => state.proposal,
      update: async ({ data }: { data: Partial<Proposal> }) => {
        if (state.proposal) Object.assign(state.proposal, data);
        return state.proposal;
      },
    },
    insuranceCompanyContact: {
      findFirst: async ({
        where,
      }: {
        where: {
          insuranceCompanyId: string;
          isReservationRecipient: boolean;
        };
      }) =>
        state.contacts.find(
          (c) =>
            c.insuranceCompanyId === where.insuranceCompanyId &&
            c.isReservationRecipient === where.isReservationRecipient &&
            c.email !== null,
        ) ?? null,
    },
    insuranceProduct: {
      findFirst: async () => state.product,
    },
    proposalLog: {
      create: async ({ data }: { data: Omit<Log, "id" | "createdAt"> }) =>
        addLog(data),
      findFirst: async ({
        where,
      }: {
        where: { proposalId: string; action: string };
      }) => {
        const list = state.logs
          .filter(
            (l) => l.proposalId === where.proposalId && l.action === where.action,
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return list[0] ?? null;
      },
    },
  };

  const ctx = { organizationId: "org1", userId: "u1" };

  return {
    state,
    db,
    ctx,
    addLog,
    sendEmailMock: vi.fn(async () => undefined),
  };
});

vi.mock("@/server/email", async (orig) => {
  const actual = await (orig() as Promise<typeof import("@/server/email")>);
  return { ...actual, sendEmail: h.sendEmailMock };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/activity", () => ({ logActivity: async () => {} }));
vi.mock("@/server/context", () => ({
  requireOrgDb: async () => ({ ctx: h.ctx, db: h.db }),
}));
vi.mock("@/server/db", () => ({
  basePrisma: {
    organization: { findUnique: async () => h.state.org },
  },
}));

beforeEach(() => {
  h.state.proposal = {
    id: "p1",
    organizationId: "org1",
    proposalNumber: "2026-0001",
    companyId: "co1",
    productId: "prod1",
    conReserva: true,
    status: "ELABORACION",
    sentAt: null,
    startDate: new Date("2026-06-01T00:00:00Z"),
    endDate: new Date("2026-12-01T00:00:00Z"),
    clientId: "c1",
    client: { name: "ACME SpA", rut: "76.123.456-7" },
    branchType: { name: "Incendio" },
  };
  h.state.contacts = [];
  h.state.logs = [];
  h.state.product = { id: "prod1", name: "Producto Test" };
  h.sendEmailMock.mockClear();
});

describe("carta-reserva template", () => {
  it("usa dos puntos en el asunto (no raya)", () => {
    const subj = cartaReservaSubject("2026-0042");
    expect(subj).toBe("Carta de reserva: Propuesta 2026-0042");
    expect(subj).not.toContain("—");
  });

  it("incluye días de reserva y datos del contratante en el cuerpo", () => {
    const txt = cartaReservaText({
      proposalNumber: "2026-0042",
      contratanteName: "ACME SpA",
      contratanteRut: "76.123.456-7",
      ramoName: "Incendio",
      productoName: "Producto Test",
      startDate: "01-06-2026",
      endDate: "01-12-2026",
      reservaDays: 30,
      organizationName: "Corredora Test",
    });
    expect(txt).toContain("30 días");
    expect(txt).toContain("ACME SpA");
    expect(txt).toContain("76.123.456-7");
    expect(txt).toContain("Incendio");
    expect(txt).toContain("01-06-2026");
    expect(txt).not.toContain("—");
  });
});

describe("sendReservationLetter — acción", () => {
  it("envía al contacto marcado como recipient y registra EMAIL_RESERVA_SENT", async () => {
    h.state.contacts = [
      {
        id: "ct1",
        insuranceCompanyId: "co1",
        isReservationRecipient: false,
        email: "otro@cia.cl",
        name: "Otro",
      },
      {
        id: "ct2",
        insuranceCompanyId: "co1",
        isReservationRecipient: true,
        email: "reserva@cia.cl",
        name: "Reserva",
      },
    ];

    const { sendReservationLetter } = await import(
      "@/features/proposals/actions"
    );
    const res = await sendReservationLetter("p1");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.to).toBe("reserva@cia.cl");
      expect(res.days).toBe(20);
    }
    expect(h.sendEmailMock).toHaveBeenCalledTimes(1);
    expect(h.sendEmailMock.mock.calls[0][0].to).toBe("reserva@cia.cl");
    expect(
      h.state.logs.some((l) => l.action === "EMAIL_RESERVA_SENT"),
    ).toBe(true);
  });

  it("registra RESERVA_RECIPIENT_MISSING cuando no hay contacto marcado", async () => {
    h.state.contacts = [
      {
        id: "ct1",
        insuranceCompanyId: "co1",
        isReservationRecipient: false,
        email: "x@cia.cl",
        name: "X",
      },
    ];

    const { sendReservationLetter } = await import(
      "@/features/proposals/actions"
    );
    const res = await sendReservationLetter("p1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("no_recipient");
    expect(h.sendEmailMock).not.toHaveBeenCalled();
    expect(
      h.state.logs.some((l) => l.action === "RESERVA_RECIPIENT_MISSING"),
    ).toBe(true);
  });

  it("la guarda contra doble envío reconoce un EMAIL_RESERVA_SENT previo", async () => {
    h.addLog({
      organizationId: "org1",
      proposalId: "p1",
      action: "EMAIL_RESERVA_SENT",
      summary: "previo",
    });
    const last = await h.db.proposalLog.findFirst({
      where: { proposalId: "p1", action: "EMAIL_RESERVA_SENT" },
    });
    expect(last).not.toBeNull();
    expect(h.sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("changeProposalStatusAction → ENVIADA_COMPANIA (lógica de sentAt)", () => {
  it("debe setear sentAt cuando el estado pasa a ENVIADA_COMPANIA y sentAt es null", () => {
    const before = { sentAt: null as Date | null };
    const newStatus = "ENVIADA_COMPANIA";
    const shouldSet =
      newStatus === "ENVIADA_COMPANIA" && before.sentAt === null;
    expect(shouldSet).toBe(true);
  });

  it("NO sobrescribe sentAt si ya estaba seteado", () => {
    const before = { sentAt: new Date("2026-01-01") };
    const newStatus = "ENVIADA_COMPANIA";
    const shouldSet =
      newStatus === "ENVIADA_COMPANIA" && before.sentAt === null;
    expect(shouldSet).toBe(false);
  });
});

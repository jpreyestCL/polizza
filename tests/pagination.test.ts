import { describe, it, expect } from "vitest";
import {
  parsePageParams,
  cursorArgs,
  buildPaginated,
  pageHref,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@/lib/pagination";

describe("parsePageParams", () => {
  it("usa defaults cuando no hay searchParams", () => {
    const p = parsePageParams(undefined);
    expect(p).toEqual({
      cursor: null,
      direction: "next",
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it("rescata cursor y direction", () => {
    const p = parsePageParams({ cursor: "abc", dir: "prev" });
    expect(p.cursor).toBe("abc");
    expect(p.direction).toBe("prev");
  });

  it("clampa pageSize a MAX_PAGE_SIZE", () => {
    const p = parsePageParams({ size: "5000" });
    expect(p.pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("ignora tamaños inválidos", () => {
    expect(parsePageParams({ size: "abc" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageParams({ size: "-10" }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe("cursorArgs", () => {
  it("sin cursor pide pageSize+1 sin skip", () => {
    const args = cursorArgs({ cursor: null, direction: "next", pageSize: 50 });
    expect(args).toEqual({ take: 51 });
  });

  it("con cursor agrega skip:1", () => {
    const args = cursorArgs({ cursor: "x", direction: "next", pageSize: 50 });
    expect(args).toEqual({ take: 51, cursor: { id: "x" }, skip: 1 });
  });

  it("prev invierte el signo del take", () => {
    const args = cursorArgs({ cursor: "x", direction: "prev", pageSize: 50 });
    expect(args.take).toBe(-51);
  });
});

describe("buildPaginated", () => {
  const rows = Array.from({ length: 6 }, (_, i) => ({ id: `r${i + 1}` }));

  it("detecta nextCursor cuando hay extra", () => {
    const p = buildPaginated(rows, {
      cursor: null,
      direction: "next",
      pageSize: 5,
    });
    expect(p.rows).toHaveLength(5);
    expect(p.nextCursor).toBe("r5");
    expect(p.prevCursor).toBeNull();
  });

  it("no hay next si trajo menos del pageSize", () => {
    const p = buildPaginated(rows.slice(0, 3), {
      cursor: null,
      direction: "next",
      pageSize: 5,
    });
    expect(p.nextCursor).toBeNull();
  });

  it("prevCursor existe cuando venimos de un cursor", () => {
    const p = buildPaginated(rows.slice(0, 5), {
      cursor: "before",
      direction: "next",
      pageSize: 5,
    });
    expect(p.prevCursor).toBe("r1");
  });
});

describe("pageHref", () => {
  it("genera siguiente preservando params extra", () => {
    const href = pageHref(
      "/clientes",
      { status: "ACTIVO", cursor: "viejo", dir: "next" },
      { cursor: "nuevo", direction: "next" },
    );
    expect(href).toContain("/clientes?");
    expect(href).toContain("status=ACTIVO");
    expect(href).toContain("cursor=nuevo");
    expect(href).toContain("dir=next");
  });

  it("devuelve base sin query si no hay next ni params", () => {
    expect(pageHref("/clientes", undefined, null)).toBe("/clientes");
  });
});

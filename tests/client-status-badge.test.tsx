import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";

describe("ClientStatusBadge", () => {
  it("muestra la etiqueta de un estado conocido", () => {
    render(<ClientStatusBadge status="ACTIVO" />);
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("usa el valor crudo para un estado desconocido", () => {
    render(<ClientStatusBadge status="DESCONOCIDO" />);
    expect(screen.getByText("DESCONOCIDO")).toBeInTheDocument();
  });
});

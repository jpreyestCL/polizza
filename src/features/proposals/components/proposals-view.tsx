"use client";

import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";
import type { ProposalListItem } from "../queries";
import type { CatalogItem } from "@/features/catalog/queries";
import { ProposalsKanban } from "./proposals-kanban";
import { ProposalsTable } from "./proposals-table";
import { Button } from "@/components/ui/button";

export function ProposalsView({
  proposals,
  companies,
  returnReasons,
}: {
  proposals: ProposalListItem[];
  companies: CatalogItem[];
  returnReasons: CatalogItem[];
}) {
  const [view, setView] = useState<"kanban" | "list">("kanban");

  return (
    <div className="space-y-4">
      <div className="flex gap-1">
        <Button
          type="button"
          variant={view === "kanban" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("kanban")}
        >
          <LayoutGrid />
          Kanban
        </Button>
        <Button
          type="button"
          variant={view === "list" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("list")}
        >
          <List />
          Lista
        </Button>
      </div>

      {view === "kanban" ? (
        <ProposalsKanban
          proposals={proposals}
          companies={companies}
          returnReasons={returnReasons}
        />
      ) : (
        <ProposalsTable proposals={proposals} companies={companies} />
      )}
    </div>
  );
}

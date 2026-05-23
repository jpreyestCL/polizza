"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogItem } from "@/features/catalog/queries";
import type { ProposalStatusValue } from "../schemas";
import { StatusChangeDialog } from "./status-change-dialog";

export function ProposalStatusButton({
  proposalId,
  currentStatus,
  returnReasons,
}: {
  proposalId: string;
  currentStatus: ProposalStatusValue;
  returnReasons: CatalogItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <ArrowLeftRight />
        Cambiar estado
      </Button>
      <StatusChangeDialog
        proposalId={proposalId}
        currentStatus={currentStatus}
        returnReasons={returnReasons}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

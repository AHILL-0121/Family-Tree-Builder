"use client";

import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ClearTreeDialogProps {
  open: boolean;
  count: number;
  treeName: string;
  onOpenChange: (open: boolean) => void;
  onBackup: () => void;
  onConfirm: () => void;
}

const btn = "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border px-3.5 text-[13px] font-medium";

export function ClearTreeDialog({ open, count, treeName, onOpenChange, onBackup, onConfirm }: ClearTreeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] gap-5 rounded-[14px] border-rule bg-surface max-sm:w-[calc(100%-32px)] max-sm:rounded-[14px]">
        <DialogHeader className="gap-3 space-y-0 text-left">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-wash text-brand" aria-hidden>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <DialogTitle className="font-serif text-[21px] font-medium">Clear the whole tree?</DialogTitle>
          <DialogDescription className="text-sm text-ink-2">
            This removes all {count} {count === 1 ? "person" : "people"} in <span className="font-medium text-ink">{treeName || "this tree"}</span> from the canvas and from this browser&apos;s autosave.
            You can undo it until you close or reload the page; after that it&apos;s gone unless you have a backup.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <button type="button" className={`${btn} mr-auto border-transparent text-ink-2 hover:bg-rule-2 hover:text-ink max-sm:mr-0`} onClick={onBackup}>
            Download backup first
          </button>
          <button type="button" className={`${btn} border-rule bg-card hover:border-line`} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button type="button" className={`${btn} border-brand bg-brand text-white hover:opacity-90 dark:text-ink`} onClick={onConfirm}>
            Clear tree
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface PhotoViewerProps {
  src: string | null;
  name: string;
  caption?: string;
  onClose: () => void;
}

// A person's photo at full size. Esc closes only the viewer, not the panel behind it.
export function PhotoViewer({ src, name, caption, onClose }: PhotoViewerProps) {
  return (
    <Dialog open={!!src} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="w-auto max-w-[min(92vw,640px)] gap-3 rounded-[14px] border-rule bg-surface p-3 max-sm:w-[calc(100%-32px)]"
        onEscapeKeyDown={(e) => e.stopPropagation()}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Photo of ${name}`} className="max-h-[72vh] min-w-[min(320px,80vw)] rounded-[10px] bg-portrait object-contain" />
        )}
        <div className="px-1 pb-1 pr-8">
          <DialogTitle className="font-serif text-[19px] font-medium leading-tight">{name}</DialogTitle>
          <DialogDescription className={caption ? "font-mono text-xs text-ink-3" : "sr-only"}>{caption || "Photo"}</DialogDescription>
        </div>
      </DialogContent>
    </Dialog>
  );
}

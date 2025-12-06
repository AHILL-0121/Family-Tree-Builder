"use client";

import React, { useRef } from "react";
import { Person, FamilyTreeData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { validateFamilyTreeJson, createExportData } from "@/lib/json-schema";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, RotateCcw } from "lucide-react";

interface JsonControlsProps {
  people: Person[];
  onImport: (data: FamilyTreeData) => void;
  onResetLayout: () => void;
}

export function JsonControls({ people, onImport, onResetLayout }: JsonControlsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = createExportData(people);
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `family-tree-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: "Family tree has been downloaded as JSON",
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const validation = validateFamilyTreeJson(json);

      if (!validation.valid) {
        toast({
          title: "Import Error",
          description: validation.error,
          variant: "destructive",
        });
        return;
      }

      onImport(validation.data!);
      toast({
        title: "Imported",
        description: `Loaded ${validation.data!.people.length} family members`,
      });
    } catch (error) {
      toast({
        title: "Import Error",
        description: "Failed to parse JSON file",
        variant: "destructive",
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleResetLayout = () => {
    onResetLayout();
    toast({
      title: "Layout Reset",
      description: "All positions have been reset to auto-layout",
    });
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={handleImportClick}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <Button variant="outline" onClick={handleExport} disabled={people.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
      
      <Button
        variant="outline"
        className="w-full"
        onClick={handleResetLayout}
        disabled={people.length === 0}
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Reset Layout
      </Button>
    </div>
  );
}

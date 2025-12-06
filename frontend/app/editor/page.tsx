"use client";

import React, { useState, useCallback } from "react";
import { Person, FamilyTreeData, Position, getFullName, createEmptyPerson } from "@/lib/types";
import { PersonForm } from "@/components/PersonForm";
import { PersonList } from "@/components/PersonList";
import { TreeCanvas } from "@/components/TreeCanvas";
import { JsonControls } from "@/components/JsonControls";
import { useToast } from "@/hooks/use-toast";
import { TreePine, LayoutGrid, AlignHorizontalDistributeCenter, Home } from "lucide-react";
import { computeAutoAlignPositions } from "@/lib/tree-layout";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DialogMode = 
  | { type: "add"; relativeType?: "parent" | "child" | "spouse" | "sibling"; relativeToId?: string; spouseId?: string }
  | { type: "edit"; person: Person; spouseId?: string }
  | { type: "new" } // For creating first person or from starter node
  | null;

export default function EditorPage() {
  const { toast } = useToast();
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogPerson, setDialogPerson] = useState<Person | null>(null);
  const [viewMode, setViewMode] = useState<"standard" | "fancy">("standard");

  // Update an existing person
  const handleUpdatePerson = useCallback((updatedPerson: Person) => {
    setPeople((prev) => {
      let newPeople = prev.map((p) => (p.id === updatedPerson.id ? updatedPerson : p));
      
      // Sync relationships
      // Ensure symmetric spouse relationships
      updatedPerson.spouseIds.forEach((spouseId) => {
        newPeople = newPeople.map((p) => {
          if (p.id === spouseId && !p.spouseIds.includes(updatedPerson.id)) {
            return { ...p, spouseIds: [...p.spouseIds, updatedPerson.id] };
          }
          return p;
        });
      });

      // Ensure symmetric parent-child relationships
      updatedPerson.childIds.forEach((childId) => {
        newPeople = newPeople.map((p) => {
          if (p.id === childId && !p.parentIds.includes(updatedPerson.id)) {
            return { ...p, parentIds: [...p.parentIds, updatedPerson.id] };
          }
          return p;
        });
      });

      updatedPerson.parentIds.forEach((parentId) => {
        newPeople = newPeople.map((p) => {
          if (p.id === parentId && !p.childIds.includes(updatedPerson.id)) {
            return { ...p, childIds: [...p.childIds, updatedPerson.id] };
          }
          return p;
        });
      });

      return newPeople;
    });
  }, []);

  // Delete a person and clean up all references
  const handleDeletePerson = useCallback((personId: string) => {
    setPeople((prev) => {
      // Remove the person
      let newPeople = prev.filter((p) => p.id !== personId);
      
      // Clean up references in other people
      newPeople = newPeople.map((p) => ({
        ...p,
        spouseIds: p.spouseIds.filter((id) => id !== personId),
        parentIds: p.parentIds.filter((id) => id !== personId),
        childIds: p.childIds.filter((id) => id !== personId),
        marriages: p.marriages.filter((m) => m.spouseId !== personId),
      }));

      return newPeople;
    });

    if (selectedPerson?.id === personId) {
      setSelectedPerson(null);
    }

    toast({
      title: "Deleted",
      description: "Person has been removed from the family tree",
    });
  }, [selectedPerson, toast]);

  // Handle selecting a person from the tree
  const handleSelectPerson = useCallback((person: Person | null) => {
    setSelectedPerson(person);
  }, []);

  // Handle cancel editing
  const handleCancelEdit = useCallback(() => {
    setSelectedPerson(null);
    setDialogMode(null);
    setDialogPerson(null);
  }, []);

  // Handle adding a relative - opens dialog with pre-configured form
  const handleAddRelative = useCallback((type: "parent" | "child" | "spouse" | "sibling", relativeToId?: string, spouseId?: string) => {
    const relativeTo = people.find((p) => p.id === relativeToId);
    
    const newId = crypto.randomUUID();
    const newPerson = createEmptyPerson(newId);
    
    if (type === "parent" && relativeToId) {
      newPerson.childIds = [relativeToId];
    } else if (type === "child" && relativeToId) {
      // For child, set parentIds to include both the person AND their spouse if provided
      newPerson.parentIds = spouseId ? [relativeToId, spouseId] : [relativeToId];
    } else if (type === "spouse" && relativeToId) {
      newPerson.spouseIds = [relativeToId!];
    } else if (type === "sibling" && relativeTo) {
      // This new person will share parents with the relativeTo person
      newPerson.parentIds = [...relativeTo.parentIds];
    }
    
    setDialogPerson(newPerson);
    setDialogMode({ type: "add", relativeType: type, relativeToId, spouseId });
  }, [people]);

  // Handle double-clicking on a node to edit or add first person
  // spouseId is provided when clicking on a person within a couple context
  const handleDoubleClickNode = useCallback((person: Person, spouseId?: string) => {
    // If person has no ID, it's the starter node - create new
    if (!person.id) {
      const newId = crypto.randomUUID();
      const newPerson = createEmptyPerson(newId);
      setDialogPerson(newPerson);
      setDialogMode({ type: "new" });
    } else {
      // Edit existing person - also track the spouse context for "Add Child" etc.
      setDialogPerson(person);
      setDialogMode({ type: "edit", person, spouseId });
    }
  }, []);

  // Handle dialog form submit for adding
  const handleDialogAdd = useCallback((person: Person) => {
    // Add the new person
    setPeople((prev) => {
      let newPeople = [...prev, person];
      
      // Update relationships symmetrically
      // If this person has parentIds, update those parents' childIds
      person.parentIds.forEach((parentId) => {
        newPeople = newPeople.map((p) => {
          if (p.id === parentId && !p.childIds.includes(person.id)) {
            return { ...p, childIds: [...p.childIds, person.id] };
          }
          return p;
        });
      });

      // If this person has childIds, update those children's parentIds
      person.childIds.forEach((childId) => {
        newPeople = newPeople.map((p) => {
          if (p.id === childId && !p.parentIds.includes(person.id)) {
            return { ...p, parentIds: [...p.parentIds, person.id] };
          }
          return p;
        });
      });

      // If this person has spouseIds, update spouse's spouseIds
      person.spouseIds.forEach((spouseId) => {
        newPeople = newPeople.map((p) => {
          if (p.id === spouseId && !p.spouseIds.includes(person.id)) {
            return { ...p, spouseIds: [...p.spouseIds, person.id] };
          }
          return p;
        });
      });
      
      return newPeople;
    });

    toast({
      title: "Added",
      description: `${getFullName(person)} has been added to the family tree`,
    });
    
    setDialogMode(null);
    setDialogPerson(null);
  }, [toast]);

  // Handle dialog form submit for editing
  const handleDialogUpdate = useCallback((updatedPerson: Person) => {
    handleUpdatePerson(updatedPerson);
    toast({
      title: "Updated",
      description: `${getFullName(updatedPerson)} has been updated`,
    });
  }, [handleUpdatePerson, toast]);

  // Import family tree data
  const handleImport = useCallback((data: FamilyTreeData) => {
    setPeople(data.people);
    setSelectedPerson(null);
  }, []);

  // Reset all manual positions
  const handleResetLayout = useCallback(() => {
    setPeople((prev) =>
      prev.map((p) => ({ ...p, position: null }))
    );
  }, []);

  // Auto-align all people by generation
  const handleAutoAlign = useCallback(() => {
    if (people.length === 0) return;
    
    const positions = computeAutoAlignPositions(people);
    
    setPeople((prev) =>
      prev.map((p) => {
        const newPos = positions.get(p.id);
        return newPos ? { ...p, position: newPos } : p;
      })
    );
    
    toast({
      title: "Auto-aligned",
      description: "Family tree has been organized by generation",
    });
  }, [people, toast]);

  // Update position for a person (drag and drop)
  const handleUpdatePosition = useCallback((id: string, position: Position) => {
    setPeople((prev) =>
      prev.map((p) => (p.id === id ? { ...p, position } : p))
    );
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TreePine className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-primary">Family Tree Generator</h1>
              <p className="text-sm text-muted-foreground">
                Create and visualize your family tree
              </p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm">
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <aside className="w-64 border-r bg-card flex flex-col flex-shrink-0">
          <div className="flex-1 overflow-auto p-3 space-y-4">
            {/* Person List */}
            <section className="bg-background rounded-lg p-3 border">
              <h3 className="text-sm font-semibold text-primary mb-2">
                Family Members ({people.length})
              </h3>
              <PersonList
                people={people}
                selectedPersonId={selectedPerson?.id || null}
                onSelectPerson={(person) => setSelectedPerson(person)}
                onDeletePerson={handleDeletePerson}
              />
            </section>

            {/* JSON Controls */}
            <section className="bg-background rounded-lg p-3 border">
              <h3 className="text-sm font-semibold text-primary mb-2">
                Import / Export
              </h3>
              <JsonControls
                people={people}
                onImport={handleImport}
                onResetLayout={handleResetLayout}
              />
            </section>

            {/* View & Layout Controls */}
            <section className="bg-background rounded-lg p-3 border">
              <h3 className="text-sm font-semibold text-primary mb-2">
                View & Layout
              </h3>
              <div className="space-y-2">
                {/* View Mode Toggle */}
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === "standard" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("standard")}
                    className="flex-1"
                    title="Standard View"
                  >
                    <LayoutGrid className="h-4 w-4 mr-1" />
                    Standard
                  </Button>
                  <Button
                    variant={viewMode === "fancy" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("fancy")}
                    className="flex-1"
                    title="Fancy Tree View"
                  >
                    <TreePine className="h-4 w-4 mr-1" />
                    Fancy
                  </Button>
                </div>
                
                {/* Auto Align Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoAlign}
                  disabled={people.length === 0 || viewMode === "fancy"}
                  className="w-full"
                  title="Auto-align generations (Standard view only)"
                >
                  <AlignHorizontalDistributeCenter className="h-4 w-4 mr-2" />
                  Auto Align
                </Button>
              </div>
            </section>
          </div>
        </aside>

        {/* Right Panel - Tree Canvas */}
        <main className="flex-1 p-4 overflow-hidden">
          <div className="w-full h-full rounded-lg border overflow-hidden shadow-inner">
            <TreeCanvas
              people={people}
              selectedPersonId={selectedPerson?.id || null}
              onSelectPerson={handleSelectPerson}
              onUpdatePosition={handleUpdatePosition}
              onDoubleClickNode={handleDoubleClickNode}
              viewMode={viewMode}
            />
          </div>
        </main>
      </div>

      {/* Form Dialog for adding/editing from tree */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => {
        if (!open) {
          setDialogMode(null);
          setDialogPerson(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode?.type === "edit" 
                ? `Edit ${dialogPerson ? getFullName(dialogPerson) : "Person"}`
                : dialogMode?.type === "add"
                  ? dialogMode.relativeType === "parent" 
                    ? "Add Parent"
                    : dialogMode.relativeType === "child"
                      ? "Add Child"
                      : dialogMode.relativeType === "spouse"
                        ? "Add Spouse"
                        : dialogMode.relativeType === "sibling"
                          ? "Add Sibling"
                          : "Add Person"
                  : dialogMode?.type === "new"
                    ? "Add Person"
                    : "Person"
              }
            </DialogTitle>
          </DialogHeader>
          {dialogPerson && (
            <PersonForm
              people={people}
              selectedPerson={dialogMode?.type === "edit" ? dialogPerson : null}
              initialPerson={(dialogMode?.type === "add" || dialogMode?.type === "new") ? dialogPerson : undefined}
              onAddPerson={handleDialogAdd}
              onUpdatePerson={handleDialogUpdate}
              onCancelEdit={handleCancelEdit}
              onAddRelative={dialogMode?.type === "edit" ? handleAddRelative : undefined}
              currentPersonId={dialogMode?.type === "edit" ? dialogPerson.id : undefined}
              currentSpouseId={dialogMode?.type === "edit" ? dialogMode.spouseId : undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

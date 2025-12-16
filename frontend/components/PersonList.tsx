"use client";

import React from "react";
import { Person, getFullName } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getInitials } from "@/lib/avatar";
import { Pencil, Trash2, Users } from "lucide-react";

interface PersonListProps {
  people: Person[];
  selectedPersonId: string | null;
  onSelectPerson: (person: Person) => void;
  onEditPerson: (person: Person) => void;
  onDeletePerson: (id: string) => void;
}

export function PersonList({
  people,
  selectedPersonId,
  onSelectPerson,
  onEditPerson,
  onDeletePerson,
}: PersonListProps) {
  if (people.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No family members yet</p>
        <p className="text-sm">Add someone to get started</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[280px]">
      <div className="space-y-2 pr-2">
        {people.map((person) => {
          const displayName = getFullName(person);
          return (
            <div
              key={person.id}
              className={`relative flex items-center p-2 rounded-lg border transition-colors cursor-pointer hover:bg-accent/50 ${
                selectedPersonId === person.id
                  ? "bg-accent border-primary"
                  : "bg-card border-border"
              }`}
              onClick={() => onSelectPerson(person)}
            >
              {/* Scrollable content area */}
              <div className="flex items-center gap-2 overflow-x-auto flex-1 pr-1" style={{ scrollbarWidth: 'thin' }}>
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {person.avatarUrl ? (
                    <img
                      src={person.avatarUrl}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover border-2 border-primary"
                    />
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground font-semibold text-xs ${
                      person.gender === "male" ? "bg-sky-600" : 
                      person.gender === "female" ? "bg-rose-500" : "bg-primary"
                    }`}>
                      {getInitials(displayName)}
                    </div>
                  )}
                </div>

                {/* Info - truncated */}
                <div className="min-w-0 flex-shrink">
                  <p className="font-medium text-sm truncate max-w-[80px]" title={displayName}>{displayName}</p>
                  <div className="text-xs text-muted-foreground">
                    {!person.birth?.date && !person.occupation && (
                      <span className="truncate block max-w-[80px]">
                        {person.spouseIds.length > 0 ? "Married" : 
                         person.parentIds.length > 0 ? `${person.parentIds.length} parent${person.parentIds.length > 1 ? "s" : ""}` : 
                         "Root member"}
                      </span>
                    )}
                    {person.birth?.date && (
                      <span className="truncate block max-w-[80px]">{person.birth.date}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions - fixed on right, always visible */}
              <div className="flex gap-0.5 flex-shrink-0 ml-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPerson(person);
                  }}
                  title="Edit"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePerson(person.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

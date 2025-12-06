"use client";

import React, { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { Person, getFullName } from "@/lib/types";
import {
  createChart,
  FancyChart,
  DescendantChart,
  HourglassChart,
  CircleRenderer,
  JsonGedcomData,
  JsonIndi,
  JsonFam,
} from "topola";
import type { ChartHandle } from "topola";
import { Button } from "@/components/ui/button";
import { Download, FileImage, FileText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FancyTreeViewProps {
  people: Person[];
  onSelectPerson?: (person: Person) => void;
  selectedPersonId?: string | null;
}

// Convert our Person data to topola's JsonGedcomData format
function convertToTopolaData(people: Person[]): JsonGedcomData {
  const indis: JsonIndi[] = [];
  const fams: JsonFam[] = [];
  const processedFamilies = new Set<string>();

  // Track families per person for proper fams/famc assignment
  const personFamiliesAsSpouse = new Map<string, string[]>();
  const personFamilyAsChild = new Map<string, string>();

  // Build parent-to-children map for efficient lookup
  const parentToChildren = new Map<string, Set<string>>();
  people.forEach((child) => {
    child.parentIds.forEach((parentId) => {
      if (!parentToChildren.has(parentId)) {
        parentToChildren.set(parentId, new Set());
      }
      parentToChildren.get(parentId)!.add(child.id);
    });
  });

  // First pass: Create all individuals
  people.forEach((person) => {
    const indi: JsonIndi = {
      id: person.id,
      firstName: person.givenName || person.name?.split(" ")[0] || "",
      lastName: person.surname || person.name?.split(" ").slice(1).join(" ") || "",
      sex: person.gender === "male" ? "M" : person.gender === "female" ? "F" : undefined,
    };

    // Add birth info
    if (person.birth && (person.birth.date || person.birth.place)) {
      indi.birth = {
        place: person.birth.place || undefined,
      };
      if (person.birth.date) {
        const dateParts = person.birth.date.split("-");
        if (dateParts.length >= 1 && dateParts[0]) {
          indi.birth.date = {
            year: parseInt(dateParts[0]) || undefined,
            month: dateParts[1] ? parseInt(dateParts[1]) : undefined,
            day: dateParts[2] ? parseInt(dateParts[2]) : undefined,
          };
        }
      }
    }

    // Add death info
    if (person.death && (person.death.date || person.death.place)) {
      indi.death = {
        place: person.death.place || undefined,
      };
      if (person.death.date) {
        const dateParts = person.death.date.split("-");
        if (dateParts.length >= 1 && dateParts[0]) {
          indi.death.date = {
            year: parseInt(dateParts[0]) || undefined,
            month: dateParts[1] ? parseInt(dateParts[1]) : undefined,
            day: dateParts[2] ? parseInt(dateParts[2]) : undefined,
          };
        }
      }
    }

    // Add avatar/image
    if (person.avatarUrl) {
      indi.images = [{ url: person.avatarUrl }];
    }

    indis.push(indi);
    personFamiliesAsSpouse.set(person.id, []);
  });

  // Second pass: Create families for each unique couple (based on marriages)
  // This ensures each spouse combination gets its own family
  people.forEach((person) => {
    // Process each marriage/spouse relationship
    person.spouseIds.forEach((spouseId) => {
      // Create a unique sorted key for this couple
      const coupleKey = [person.id, spouseId].sort().join("_");
      const famId = `fam_${coupleKey}`;

      // Skip if we already processed this couple
      if (processedFamilies.has(famId)) return;
      processedFamilies.add(famId);

      const spouse = people.find((p) => p.id === spouseId);

      // Determine husband and wife based on gender
      let husb: string | undefined;
      let wife: string | undefined;

      if (person.gender === "male") {
        husb = person.id;
        wife = spouseId;
      } else if (person.gender === "female") {
        wife = person.id;
        husb = spouseId;
      } else if (spouse?.gender === "male") {
        husb = spouseId;
        wife = person.id;
      } else if (spouse?.gender === "female") {
        wife = spouseId;
        husb = person.id;
      } else {
        husb = person.id;
        wife = spouseId;
      }

      // Find children that belong to this couple
      // A child belongs to this family if EITHER parent is in the couple's parents list
      const children: string[] = [];
      people.forEach((child) => {
        // Skip if child is already assigned to a family
        if (personFamilyAsChild.has(child.id)) return;

        const childParents = child.parentIds;
        
        if (childParents.length >= 2) {
          // Child has two parents - check if both match this couple
          const hasParent1 = childParents.includes(person.id);
          const hasParent2 = childParents.includes(spouseId);
          if (hasParent1 && hasParent2) {
            children.push(child.id);
            personFamilyAsChild.set(child.id, famId);
          }
        } else if (childParents.length === 1) {
          // Child has one parent - check if it matches one of the couple
          const singleParent = childParents[0];
          if (singleParent === person.id || singleParent === spouseId) {
            children.push(child.id);
            personFamilyAsChild.set(child.id, famId);
          }
        }
      });

      // Get marriage info if available
      let marriage: JsonFam["marriage"];
      const marriageInfo = person.marriages.find((m) => m.spouseId === spouseId);
      if (marriageInfo && marriageInfo.date) {
        const dateParts = marriageInfo.date.split("-");
        marriage = {
          place: marriageInfo.place || undefined,
          date: {
            year: parseInt(dateParts[0]) || undefined,
            month: dateParts[1] ? parseInt(dateParts[1]) : undefined,
            day: dateParts[2] ? parseInt(dateParts[2]) : undefined,
          },
        };
      }

      const fam: JsonFam = {
        id: famId,
        husb,
        wife,
        children,
        marriage,
      };

      fams.push(fam);

      // Track which families each person belongs to as spouse
      if (husb) {
        personFamiliesAsSpouse.get(husb)?.push(famId);
      }
      if (wife) {
        personFamiliesAsSpouse.get(wife)?.push(famId);
      }
    });
  });

  // Third pass: Handle single parents with children (no spouse)
  people.forEach((person) => {
    if (person.spouseIds.length === 0) {
      // Find children that have only this person as parent
      const children: string[] = [];
      people.forEach((child) => {
        if (
          child.parentIds.length === 1 &&
          child.parentIds[0] === person.id &&
          !personFamilyAsChild.has(child.id)
        ) {
          children.push(child.id);
        }
      });

      if (children.length > 0) {
        const famId = `fam_single_${person.id}`;
        if (!processedFamilies.has(famId)) {
          processedFamilies.add(famId);

          const fam: JsonFam = {
            id: famId,
            husb: person.gender === "male" ? person.id : undefined,
            wife: person.gender === "female" ? person.id : undefined,
            children,
          };

          fams.push(fam);
          personFamiliesAsSpouse.get(person.id)?.push(famId);
          children.forEach((childId) => {
            personFamilyAsChild.set(childId, famId);
          });
        }
      }
    }
  });

  // Fourth pass: Update individuals with their family references
  indis.forEach((indi) => {
    // Add fams (families where this person is a spouse)
    const spouseFams = personFamiliesAsSpouse.get(indi.id);
    if (spouseFams && spouseFams.length > 0) {
      indi.fams = spouseFams;
    }

    // Add famc (family where this person is a child)
    const childFam = personFamilyAsChild.get(indi.id);
    if (childFam) {
      indi.famc = childFam;
    }
  });


  // Verify all children in families exist as individuals
  fams.forEach(fam => {
    if (fam.children) {
      fam.children.forEach(childId => {
        const child = indis.find(i => i.id === childId);
        if (!child) {
          console.error(`Family ${fam.id} has invalid child: ${childId}`);
        } else if (child.famc !== fam.id) {
          console.error(`Child ${child.firstName} (${childId}) famc=${child.famc} doesn't match family ${fam.id}`);
        }
      });
    }
  });

  return { indis, fams };
}

// Find the root person (ancestor with no parents who has descendants)
function findRootPerson(people: Person[]): Person | null {
  if (people.length === 0) return null;

  // Find people with no parents
  const noParents = people.filter((p) => p.parentIds.length === 0);

  if (noParents.length === 0) return people[0];

  // Calculate generation depth for each person
  const getDepth = (personId: string, visited: Set<string> = new Set()): number => {
    if (visited.has(personId)) return 0;
    visited.add(personId);
    
    const person = people.find((p) => p.id === personId);
    if (!person) return 0;

    // Find all descendants
    let maxChildDepth = 0;
    people.forEach((child) => {
      if (child.parentIds.includes(personId)) {
        maxChildDepth = Math.max(maxChildDepth, 1 + getDepth(child.id, visited));
      }
    });

    return maxChildDepth;
  };

  // Prefer the root person with the most generations below them
  let bestRoot: Person | null = null;
  let maxDepth = -1;

  noParents.forEach((p) => {
    const depth = getDepth(p.id);
    if (depth > maxDepth || (depth === maxDepth && p.spouseIds.length > 0)) {
      maxDepth = depth;
      bestRoot = p;
    }
  });

  return bestRoot || noParents[0];
}

// Find the root family ID - prefer family with children
function findRootFamily(data: JsonGedcomData, rootPersonId: string): string | null {
  // Find all families where this person is a spouse
  const spouseFams = data.fams.filter(
    (f) => f.husb === rootPersonId || f.wife === rootPersonId
  );

  if (spouseFams.length === 0) return null;

  // Prefer family with children
  const famWithChildren = spouseFams.find((f) => f.children && f.children.length > 0);
  return famWithChildren?.id || spouseFams[0]?.id || null;
}

export function FancyTreeView({
  people,
  onSelectPerson,
  selectedPersonId,
}: FancyTreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartHandle | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Export to PNG
  const exportToPNG = useCallback(() => {
    const svgElement = containerRef.current?.querySelector("#topola-chart") as SVGSVGElement;
    if (!svgElement) return;

    // Get SVG dimensions
    const bbox = svgElement.getBBox();
    const width = svgElement.width.baseVal.value || bbox.width + 40;
    const height = svgElement.height.baseVal.value || bbox.height + 40;

    // Clone SVG and add styles
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute("width", String(width));
    clonedSvg.setAttribute("height", String(height));

    // Serialize SVG
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    // Create canvas and draw
    const canvas = document.createElement("canvas");
    const scale = 2; // Higher resolution
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const img = new Image();
      img.onload = () => {
        // Draw background
        ctx.fillStyle = "#e0f2fe"; // sky-100 color
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        
        // Download
        const link = document.createElement("a");
        link.download = "family-tree.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  }, []);

  // Export to PDF
  const exportToPDF = useCallback(async () => {
    const svgElement = containerRef.current?.querySelector("#topola-chart") as SVGSVGElement;
    if (!svgElement) return;

    // Get SVG dimensions
    const bbox = svgElement.getBBox();
    const width = svgElement.width.baseVal.value || bbox.width + 40;
    const height = svgElement.height.baseVal.value || bbox.height + 40;

    // Clone SVG
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute("width", String(width));
    clonedSvg.setAttribute("height", String(height));

    // Serialize SVG
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    // Create canvas
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      const img = new Image();
      img.onload = async () => {
        // Draw background
        ctx.fillStyle = "#e0f2fe";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        // Convert to PDF using browser print
        const dataUrl = canvas.toDataURL("image/png");
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Family Tree</title>
                <style>
                  @page { size: landscape; margin: 0; }
                  body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                  img { max-width: 100%; max-height: 100vh; }
                </style>
              </head>
              <body>
                <img src="${dataUrl}" />
                <script>
                  window.onload = function() { window.print(); window.close(); }
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
        
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
  }, []);

  // Convert data to topola format
  const topolaData = useMemo(() => {
    if (people.length === 0) return null;
    try {
      return convertToTopolaData(people);
    } catch (err) {
      console.error("Error converting data:", err);
      setError("Error converting family data");
      return null;
    }
  }, [people]);

  // Find root person and family
  const rootInfo = useMemo(() => {
    if (!topolaData || people.length === 0) return null;
    const rootPerson = findRootPerson(people);
    if (!rootPerson) return null;

    const rootFamily = findRootFamily(topolaData, rootPerson.id);

    return {
      rootPersonId: rootPerson.id,
      rootFamilyId: rootFamily,
    };
  }, [topolaData, people]);

  // Handle click on individual
  const handleIndiClick = useCallback(
    (info: { id: string }) => {
      const person = people.find((p) => p.id === info.id);
      if (person && onSelectPerson) {
        onSelectPerson(person);
      }
    },
    [people, onSelectPerson]
  );

  // Initialize and update chart
  useEffect(() => {
    if (!containerRef.current || !topolaData || !rootInfo) return;

    // Clear previous chart content
    const svgElement = containerRef.current.querySelector("#topola-chart") as SVGSVGElement;
    if (svgElement) {
      svgElement.innerHTML = "";
    }

    try {
      setError(null);
      
      // Create the chart - FancyChart renders a descendant tree with fancy visuals
      chartRef.current = createChart({
        json: topolaData,
        chartType: FancyChart,
        renderer: CircleRenderer,
        svgSelector: "#topola-chart",
        animate: true,
        updateSvgSize: true,
        indiCallback: handleIndiClick,
      });

      // Render starting from root family or root individual
      if (rootInfo.rootFamilyId) {
        chartRef.current.render({
          startFam: rootInfo.rootFamilyId,
        });
      } else {
        chartRef.current.render({
          startIndi: rootInfo.rootPersonId,
        });
      }
    } catch (err) {
      console.error("Error creating topola chart:", err);
      setError(`Error rendering chart: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    return () => {
      chartRef.current = null;
    };
  }, [topolaData, rootInfo, handleIndiClick]);

  if (people.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No family members to display
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto bg-gradient-to-b from-sky-100 to-green-100 relative"
      style={{ minHeight: "600px" }}
    >
      {/* Export buttons */}
      <div className="absolute top-4 left-4 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="bg-white/90 hover:bg-white">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={exportToPNG}>
              <FileImage className="w-4 h-4 mr-2" />
              Export as PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToPDF}>
              <FileText className="w-4 h-4 mr-2" />
              Print / Save as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <svg
        id="topola-chart"
      />
    </div>
  );
}

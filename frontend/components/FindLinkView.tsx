"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Person } from "@/lib/types";
import { findRelationship, RelationshipResult } from "@/lib/relationships";
import { select } from "d3-selection";
import { zoom, zoomIdentity, ZoomBehavior } from "d3-zoom";

export interface FindLinkViewProps {
  people: Person[];
  onClose: () => void;
}

function getDefaultAvatar(name: string, gender: string): string {
  const colors: Record<string, { bg: string; text: string }> = {
    male: { bg: "#3b82f6", text: "#ffffff" },
    female: { bg: "#ec4899", text: "#ffffff" },
    other: { bg: "#6b7280", text: "#ffffff" },
    "": { bg: "#6b7280", text: "#ffffff" },
  };
  const color = colors[gender] || colors[""];
  const initial = (name || "?")[0].toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="50" fill="${color.bg}"/>
    <text x="50" y="50" dy="0.35em" text-anchor="middle" fill="${color.text}" font-size="40" font-family="Arial, sans-serif" font-weight="bold">${initial}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

interface LayoutNode {
  id: string;
  person: Person;
  x: number;
  y: number;
  avatar: string;
  displayName: string;
}

function buildLayout(people: Person[]): LayoutNode[] {
  if (people.length === 0) return [];

  const relevantMap = new Map(people.map(p => [p.id, p]));
  const generations = new Map<string, number>();
  
  const findRoots = () => people.filter(p => !p.parentIds.some(pid => relevantMap.has(pid)));
  const roots = findRoots();
  
  roots.forEach(r => generations.set(r.id, 0));

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 100) {
    changed = false;
    iterations++;
    
    people.forEach(person => {
      const parentGens = person.parentIds
        .filter(pid => relevantMap.has(pid) && generations.has(pid))
        .map(pid => generations.get(pid)!);
      
      if (parentGens.length > 0) {
        const expectedGen = Math.max(...parentGens) + 1;
        const currentGen = generations.get(person.id);
        if (currentGen === undefined || currentGen < expectedGen) {
          generations.set(person.id, expectedGen);
          changed = true;
        }
      }
      
      person.spouseIds.forEach(spouseId => {
        if (!relevantMap.has(spouseId)) return;
        const myGen = generations.get(person.id);
        const spouseGen = generations.get(spouseId);
        if (myGen !== undefined && (spouseGen === undefined || spouseGen < myGen)) {
          generations.set(spouseId, myGen);
          changed = true;
        } else if (spouseGen !== undefined && (myGen === undefined || myGen < spouseGen)) {
          generations.set(person.id, spouseGen);
          changed = true;
        }
      });
    });
  }

  people.forEach(p => {
    if (!generations.has(p.id)) generations.set(p.id, 0);
  });

  const genGroups = new Map<number, Person[]>();
  people.forEach(person => {
    const gen = generations.get(person.id) || 0;
    if (!genGroups.has(gen)) genGroups.set(gen, []);
    genGroups.get(gen)!.push(person);
  });

  const sortedGens = Array.from(genGroups.keys()).sort((a, b) => a - b);
  const NODE_SPACING = 120;
  const SPOUSE_GAP = 85;
  const LEVEL_HEIGHT = 140;

  const nodes: LayoutNode[] = [];
  const nodePositions = new Map<string, { x: number; y: number }>();

  sortedGens.forEach((gen, genIndex) => {
    const genPeople = genGroups.get(gen)!;
    const positioned = new Set<string>();
    const ordered: Person[] = [];

    genPeople.forEach(person => {
      if (positioned.has(person.id)) return;
      ordered.push(person);
      positioned.add(person.id);
      person.spouseIds.forEach(spouseId => {
        const spouse = genPeople.find(p => p.id === spouseId);
        if (spouse && !positioned.has(spouseId)) {
          ordered.push(spouse);
          positioned.add(spouseId);
        }
      });
    });

    let currentX = 0;
    ordered.forEach((person, idx) => {
      const prev = idx > 0 ? ordered[idx - 1] : null;
      const isSpouseOfPrev = prev && person.spouseIds.includes(prev.id);
      if (idx > 0) currentX += isSpouseOfPrev ? SPOUSE_GAP : NODE_SPACING;
      nodePositions.set(person.id, { x: currentX, y: genIndex * LEVEL_HEIGHT });
    });
  });

  const allX = Array.from(nodePositions.values()).map(p => p.x);
  const minX = Math.min(...allX, 0);
  const maxX = Math.max(...allX, 0);
  const centerOffset = (minX + maxX) / 2;

  people.forEach(person => {
    const pos = nodePositions.get(person.id);
    if (!pos) return;
    const displayName = person.givenName || person.name || "Unknown";
    const avatar = person.avatarUrl || getDefaultAvatar(displayName, person.gender);
    nodes.push({
      id: person.id,
      person,
      x: pos.x - centerOffset,
      y: pos.y,
      avatar,
      displayName,
    });
  });

  return nodes;
}

export function FindLinkView({ people, onClose }: FindLinkViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPerson1, setSelectedPerson1] = useState<Person | null>(null);
  const [selectedPerson2, setSelectedPerson2] = useState<Person | null>(null);
  const [relationship, setRelationship] = useState<RelationshipResult | null>(null);

  const handleNodeClick = useCallback((person: Person) => {
    if (!selectedPerson1) {
      setSelectedPerson1(person);
      setSelectedPerson2(null);
      setRelationship(null);
    } else if (!selectedPerson2 && person.id !== selectedPerson1.id) {
      setSelectedPerson2(person);
      const result = findRelationship(people, selectedPerson1, person);
      setRelationship(result);
    } else {
      // Reset and start fresh
      setSelectedPerson1(person);
      setSelectedPerson2(null);
      setRelationship(null);
    }
  }, [selectedPerson1, selectedPerson2, people]);

  const resetSelection = useCallback(() => {
    setSelectedPerson1(null);
    setSelectedPerson2(null);
    setRelationship(null);
  }, []);

  const renderChart = useCallback(() => {
    if (!containerRef.current || people.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    select(container).select("svg").remove();

    const svg = select(container)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background", "#f0fdf4");

    const g = svg.append("g").attr("class", "main-group");

    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2.5])
      .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoomBehavior);

    const nodes = buildLayout(people);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    if (nodes.length === 0) return;

    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y));
    
    const treeWidth = maxX - minX + 200;
    const treeHeight = maxY - minY + 200;
    const scale = Math.min(width / treeWidth, height / treeHeight, 1) * 0.8;
    const centerX = width / 2;
    const centerY = height / 2 - ((minY + maxY) / 2) * scale + 50;
    
    svg.call(zoomBehavior.transform, zoomIdentity.translate(centerX, centerY).scale(scale));

    const NODE_RADIUS = 38;
    const linksGroup = g.append("g").attr("class", "links");

    // Draw relationship lines
    people.forEach(person => {
      const sourceNode = nodeMap.get(person.id);
      if (!sourceNode) return;

      person.parentIds.forEach(parentId => {
        const targetNode = nodeMap.get(parentId);
        if (!targetNode) return;
        
        const isInPath = relationship?.path.includes(person.id) && relationship?.path.includes(parentId);
        const pathIdx1 = relationship?.path.indexOf(person.id) ?? -1;
        const pathIdx2 = relationship?.path.indexOf(parentId) ?? -1;
        const isAdjacent = Math.abs(pathIdx1 - pathIdx2) === 1;

        linksGroup.append("path")
          .attr("d", `M ${targetNode.x} ${targetNode.y + NODE_RADIUS} 
                      C ${targetNode.x} ${(targetNode.y + sourceNode.y) / 2}, 
                        ${sourceNode.x} ${(targetNode.y + sourceNode.y) / 2}, 
                        ${sourceNode.x} ${sourceNode.y - NODE_RADIUS}`)
          .attr("fill", "none")
          .attr("stroke", isInPath && isAdjacent ? "#f59e0b" : "#94a3b8")
          .attr("stroke-width", isInPath && isAdjacent ? 4 : 2);
      });

      person.spouseIds.forEach(spouseId => {
        if (person.id > spouseId) return;
        const targetNode = nodeMap.get(spouseId);
        if (!targetNode) return;

        const isInPath = relationship?.path.includes(person.id) && relationship?.path.includes(spouseId);
        const pathIdx1 = relationship?.path.indexOf(person.id) ?? -1;
        const pathIdx2 = relationship?.path.indexOf(spouseId) ?? -1;
        const isAdjacent = Math.abs(pathIdx1 - pathIdx2) === 1;

        linksGroup.append("line")
          .attr("x1", sourceNode.x)
          .attr("y1", sourceNode.y)
          .attr("x2", targetNode.x)
          .attr("y2", targetNode.y)
          .attr("stroke", isInPath && isAdjacent ? "#f59e0b" : "#f472b6")
          .attr("stroke-width", isInPath && isAdjacent ? 4 : 2)
          .attr("stroke-dasharray", isInPath && isAdjacent ? "none" : "6,4");
      });
    });

    // Define clip paths
    const defs = svg.append("defs");
    nodes.forEach(node => {
      defs.append("clipPath")
        .attr("id", `findlink-clip-${node.id}`)
        .append("circle")
        .attr("r", NODE_RADIUS - 3)
        .attr("cx", 0)
        .attr("cy", 0);
    });

    // Draw nodes
    const nodesGroup = g.append("g").attr("class", "nodes");

    const nodeGroups = nodesGroup.selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x}, ${d.y})`)
      .style("cursor", "pointer");

    // Node circles
    nodeGroups.append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", "#ffffff")
      .attr("stroke", d => {
        if (d.id === selectedPerson1?.id) return "#16a34a";
        if (d.id === selectedPerson2?.id) return "#dc2626";
        if (relationship?.path.includes(d.id)) return "#f59e0b";
        return d.person.gender === "female" ? "#ec4899" : "#3b82f6";
      })
      .attr("stroke-width", d => {
        if (d.id === selectedPerson1?.id || d.id === selectedPerson2?.id) return 5;
        if (relationship?.path.includes(d.id)) return 4;
        return 3;
      });

    // Images
    nodeGroups.append("image")
      .attr("x", -NODE_RADIUS + 3)
      .attr("y", -NODE_RADIUS + 3)
      .attr("width", (NODE_RADIUS - 3) * 2)
      .attr("height", (NODE_RADIUS - 3) * 2)
      .attr("clip-path", d => `url(#findlink-clip-${d.id})`)
      .attr("preserveAspectRatio", "xMidYMid slice")
      .attr("href", d => d.avatar);

    // Name labels below nodes
    nodeGroups.append("text")
      .attr("y", NODE_RADIUS + 16)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("fill", "#374151")
      .text(d => d.displayName);

    // Selection indicators
    nodeGroups.each(function(d) {
      if (d.id === selectedPerson1?.id) {
        select(this).append("text")
          .attr("y", -NODE_RADIUS - 8)
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("font-weight", "bold")
          .attr("fill", "#16a34a")
          .text("Person 1");
      }
      if (d.id === selectedPerson2?.id) {
        select(this).append("text")
          .attr("y", -NODE_RADIUS - 8)
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("font-weight", "bold")
          .attr("fill", "#dc2626")
          .text("Person 2");
      }
    });

    // Click handlers
    nodeGroups.on("click", (event, d) => {
      event.stopPropagation();
      handleNodeClick(d.person);
    });

  }, [people, selectedPerson1, selectedPerson2, relationship, handleNodeClick]);

  useEffect(() => {
    renderChart();
    const handleResize = () => renderChart();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderChart]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header with instructions and result */}
      <div className="bg-white border-b p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">Find the Link</h2>
            <p className="text-sm text-muted-foreground">
              {!selectedPerson1 
                ? "Click on the first person" 
                : !selectedPerson2 
                  ? "Now click on the second person"
                  : "Click any person to start over"}
            </p>
          </div>
          <div className="flex gap-2">
            {(selectedPerson1 || selectedPerson2) && (
              <button
                onClick={resetSelection}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Reset
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Selection display */}
        {selectedPerson1 && (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-green-500">
                <img 
                  src={selectedPerson1.avatarUrl || getDefaultAvatar(selectedPerson1.givenName || "?", selectedPerson1.gender)} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-medium text-green-800">{selectedPerson1.givenName || selectedPerson1.name}</span>
            </div>

            {selectedPerson2 && (
              <>
                <span className="text-muted-foreground">↔</span>
                <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-red-500">
                    <img 
                      src={selectedPerson2.avatarUrl || getDefaultAvatar(selectedPerson2.givenName || "?", selectedPerson2.gender)} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="font-medium text-red-800">{selectedPerson2.givenName || selectedPerson2.name}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Relationship result */}
        {relationship && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-amber-700 font-medium">Relationship / உறவு</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-900">{relationship.english}</p>
                  <p className="text-xs text-amber-600">English</p>
                </div>
                <div className="hidden sm:block text-amber-300 text-2xl">|</div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-900">{relationship.tamil}</p>
                  <p className="text-xs text-amber-600">தமிழ்</p>
                </div>
              </div>
              <p className="text-xs text-amber-600 mt-2">
                {selectedPerson2?.givenName || selectedPerson2?.name} is the {relationship.english.toLowerCase()} of {selectedPerson1?.givenName || selectedPerson1?.name}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tree view */}
      <div
        ref={containerRef}
        className="flex-1"
        style={{ minHeight: "400px" }}
      />
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Person, Position, getFullName, createEmptyPerson } from "@/lib/types";
import {
  computeLayout,
  generateConnectionPath,
  NODE_RADIUS,
  LayoutResult,
  computeAutoAlignPositions,
} from "@/lib/tree-layout";
import { FancyTreeView } from "./FancyTreeView";

interface TreeCanvasProps {
  people: Person[];
  selectedPersonId: string | null;
  onSelectPerson: (person: Person | null) => void;
  onUpdatePosition: (id: string, position: Position) => void;
  onDoubleClickNode: (person: Person, spouseId?: string) => void;
  viewMode: "standard" | "fancy";
}

export function TreeCanvas({
  people,
  selectedPersonId,
  onSelectPerson,
  onUpdatePosition,
  onDoubleClickNode,
  viewMode,
}: TreeCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState<LayoutResult>({ nodes: [], width: 800, height: 600 });
  const [dragging, setDragging] = useState<{
    id: string;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Compute layout when people change
  useEffect(() => {
    const newLayout = computeLayout(people);
    setLayout(newLayout);
    setViewBox({
      x: 0,
      y: 0,
      width: Math.max(newLayout.width, 800),
      height: Math.max(newLayout.height, 600),
    });
  }, [people]);

  const getNodePosition = (id: string): Position | null => {
    const node = layout.nodes.find((n) => n.id === id);
    return node ? node.computedPosition : null;
  };

  const handleMouseDown = (e: React.MouseEvent, personId: string) => {
    e.stopPropagation();
    const pos = getNodePosition(personId);
    if (!pos) return;

    const svg = svgRef.current;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    setDragging({
      id: personId,
      startX: pos.x,
      startY: pos.y,
      offsetX: svgP.x - pos.x,
      offsetY: svgP.y - pos.y,
    });

    onSelectPerson(people.find((p) => p.id === personId) || null);
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        const svg = svgRef.current;
        if (!svg) return;

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

        const newX = svgP.x - dragging.offsetX;
        const newY = svgP.y - dragging.offsetY;

        onUpdatePosition(dragging.id, { x: newX, y: newY });
      } else if (isPanning) {
        const dx = (e.clientX - panStart.x) * (viewBox.width / 800);
        const dy = (e.clientY - panStart.y) * (viewBox.height / 600);
        setViewBox((prev) => ({
          ...prev,
          x: prev.x - dx,
          y: prev.y - dy,
        }));
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    },
    [dragging, isPanning, panStart, viewBox, onUpdatePosition]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setIsPanning(false);
  }, []);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).classList.contains("canvas-bg")) {
      onSelectPerson(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox((prev) => ({
      x: prev.x,
      y: prev.y,
      width: prev.width * scaleFactor,
      height: prev.height * scaleFactor,
    }));
  };

  // Build connection data
  const connections: { parentId: string; childId: string }[] = [];
  const spouseConnections: { id1: string; id2: string }[] = [];
  const processedSpouses = new Set<string>();

  people.forEach((person) => {
    person.parentIds.forEach((parentId) => {
      connections.push({ parentId, childId: person.id });
    });

    person.spouseIds.forEach((spouseId) => {
      const key = [person.id, spouseId].sort().join("-");
      if (!processedSpouses.has(key)) {
        processedSpouses.add(key);
        spouseConnections.push({ id1: person.id, id2: spouseId });
      }
    });
  });

  // Build couple units: each marriage creates a couple unit
  // For people with multiple spouses, they appear in multiple couple units
  interface CoupleUnit {
    id: string; // unique id for this couple unit
    person1Id: string;
    person2Id: string;
    person1: Person;
    person2: Person;
  }
  
  const coupleUnits: CoupleUnit[] = [];
  const personInCouple = new Set<string>(); // tracks who is part of at least one couple
  const processedCoupleKeys = new Set<string>();
  
  spouseConnections.forEach(({ id1, id2 }) => {
    const person1 = people.find(p => p.id === id1);
    const person2 = people.find(p => p.id === id2);
    if (!person1 || !person2) return;
    
    const coupleKey = [id1, id2].sort().join("-");
    if (processedCoupleKeys.has(coupleKey)) return;
    processedCoupleKeys.add(coupleKey);
    
    coupleUnits.push({
      id: coupleKey,
      person1Id: id1,
      person2Id: id2,
      person1,
      person2,
    });
    
    personInCouple.add(id1);
    personInCouple.add(id2);
  });

  // Handle double-click on node to open form
  // spouseId is passed when clicking on a person within a couple context
  const handleNodeDoubleClick = (e: React.MouseEvent, person: Person, spouseId?: string) => {
    e.stopPropagation();
    onDoubleClickNode(person, spouseId);
  };

  // Empty state with starter node
  if (people.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-emerald-50 to-amber-50 rounded-lg">
        <div className="text-center">
          {/* Interactive starter node */}
          <button
            onClick={() => onDoubleClickNode(createEmptyPerson(''))}
            className="group relative mb-6 transition-transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-primary/30 rounded-full"
          >
            <svg
              className="w-32 h-32 mx-auto"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Glow effect */}
              <circle
                cx="50"
                cy="50"
                r="42"
                className="fill-emerald-100 group-hover:fill-emerald-200 transition-colors"
              />
              {/* Main circle */}
              <circle
                cx="50"
                cy="50"
                r="35"
                className="fill-emerald-500 group-hover:fill-emerald-600 transition-colors"
                stroke="#059669"
                strokeWidth="3"
              />
              {/* Plus icon */}
              <path
                d="M50 35 L50 65 M35 50 L65 50"
                stroke="white"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-600 text-white text-xs font-medium px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              Click to add first person
            </span>
          </button>
          
          <p className="text-lg font-medium text-foreground mb-1">Start Your Family Tree</p>
          <p className="text-sm text-muted-foreground">Click the circle above to add the first family member</p>
        </div>
      </div>
    );
  }

  // Render Fancy Tree View
  if (viewMode === "fancy") {
    return (
      <div className="relative w-full h-full">
        <FancyTreeView
          people={people}
          selectedPersonId={selectedPersonId}
          onSelectPerson={onSelectPerson}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
      {/* Background gradient */}
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ecfdf5" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
        <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="maleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <linearGradient id="femaleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#db2777" />
        </linearGradient>
        <linearGradient id="coupleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="selectedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.2" />
        </filter>
        <clipPath id="avatarClip">
          <circle cx="0" cy="0" r={NODE_RADIUS - 3} />
        </clipPath>
      </defs>

      {/* Canvas background */}
      <rect
        className="canvas-bg"
        x={viewBox.x - 1000}
        y={viewBox.y - 1000}
        width={viewBox.width + 2000}
        height={viewBox.height + 2000}
        fill="url(#bgGradient)"
      />

      {/* Decorative tree trunk and ground */}
      <ellipse
        cx={layout.width / 2}
        cy={layout.height + 50}
        rx={layout.width / 3}
        ry={30}
        fill="#92400e"
        opacity="0.2"
      />

      {/* Compute couple positions once for reuse */}
      {(() => {
        // Calculate proper positions for each couple unit
        const couplePositions = new Map<string, { x: number; y: number }>();
        
        // Group couples by shared person to position them adjacently
        const personToCouples = new Map<string, CoupleUnit[]>();
        coupleUnits.forEach(couple => {
          [couple.person1Id, couple.person2Id].forEach(personId => {
            if (!personToCouples.has(personId)) {
              personToCouples.set(personId, []);
            }
            personToCouples.get(personId)!.push(couple);
          });
        });
        
        // Find people with multiple spouses
        const multiSpousePersons = new Map<string, CoupleUnit[]>();
        personToCouples.forEach((couples, personId) => {
          if (couples.length > 1) {
            multiSpousePersons.set(personId, couples);
          }
        });
        
        const COUPLE_UNIT_WIDTH = 148;
        const MULTI_SPOUSE_GAP = 50;
        
        // Calculate positions for multi-spouse couples
        multiSpousePersons.forEach((couples, personId) => {
          const person = people.find(p => p.id === personId);
          if (!person) return;
          
          const personPos = getNodePosition(personId);
          if (!personPos) return;
          
          const totalWidth = couples.length * COUPLE_UNIT_WIDTH + (couples.length - 1) * MULTI_SPOUSE_GAP;
          let startX = personPos.x - totalWidth / 2 + COUPLE_UNIT_WIDTH / 2;
          
          couples.forEach((couple, idx) => {
            if (!couplePositions.has(couple.id)) {
              couplePositions.set(couple.id, { x: startX + idx * (COUPLE_UNIT_WIDTH + MULTI_SPOUSE_GAP), y: personPos.y });
            }
          });
        });
        
        // For regular couples, use center of both positions
        coupleUnits.forEach(couple => {
          if (!couplePositions.has(couple.id)) {
            const pos1 = getNodePosition(couple.person1Id);
            const pos2 = getNodePosition(couple.person2Id);
            if (pos1 && pos2) {
              couplePositions.set(couple.id, { x: (pos1.x + pos2.x) / 2, y: pos1.y });
            }
          }
        });
        
        // Helper to get couple position
        const getCouplePosition = (coupleId: string) => couplePositions.get(coupleId);
        
        return (
          <>
            {/* Parent-child connections */}
            {connections.map(({ parentId, childId }) => {
              let parentPos = getNodePosition(parentId);
              let childPos = getNodePosition(childId);
              if (!parentPos || !childPos) return null;

              // Find the couple unit this parent belongs to that also contains the child's other parent
              const child = people.find(p => p.id === childId);
              if (child && child.parentIds.length === 2) {
                const otherParentId = child.parentIds.find(id => id !== parentId);
                if (otherParentId) {
                  const coupleUnit = coupleUnits.find(c => 
                    (c.person1Id === parentId && c.person2Id === otherParentId) ||
                    (c.person2Id === parentId && c.person1Id === otherParentId)
                  );
                  if (coupleUnit) {
                    const couplePos = getCouplePosition(coupleUnit.id);
                    if (couplePos) {
                      parentPos = couplePos;
                    }
                  }
                }
              } else if (personInCouple.has(parentId)) {
                const coupleUnit = coupleUnits.find(c => c.person1Id === parentId || c.person2Id === parentId);
                if (coupleUnit) {
                  const couplePos = getCouplePosition(coupleUnit.id);
                  if (couplePos) {
                    parentPos = couplePos;
                  }
                }
              }

              // If child is part of a couple
              if (personInCouple.has(childId)) {
                const coupleUnit = coupleUnits.find(c => c.person1Id === childId || c.person2Id === childId);
                if (coupleUnit) {
                  const couplePos = getCouplePosition(coupleUnit.id);
                  if (couplePos) {
                    childPos = couplePos;
                  }
                }
              }

              return (
                <path
                  key={`${parentId}-${childId}`}
                  d={generateConnectionPath(parentPos, childPos)}
                  fill="none"
                  stroke="#059669"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.7"
                />
              );
            })}

            {/* Dotted line connections between couples sharing the same spouse */}
            {(() => {
              const dottedConnections: JSX.Element[] = [];
              
              multiSpousePersons.forEach((couples, personId) => {
                // Sort couples by X position
                const sortedCouples = [...couples].sort((a, b) => {
                  const posA = getCouplePosition(a.id);
                  const posB = getCouplePosition(b.id);
                  return (posA?.x || 0) - (posB?.x || 0);
                });
                
                const HALF_WIDTH = 70;
                const GAP = 4;
                
                for (let i = 0; i < sortedCouples.length - 1; i++) {
                  const pos1 = getCouplePosition(sortedCouples[i].id);
                  const pos2 = getCouplePosition(sortedCouples[i + 1].id);
                  if (!pos1 || !pos2) continue;
                  
                  const lineStartX = pos1.x + HALF_WIDTH / 2 + GAP / 2 + 5;
                  const lineEndX = pos2.x - HALF_WIDTH / 2 - GAP / 2 - 5;
                  const lineY = (pos1.y + pos2.y) / 2;
                  
                  dottedConnections.push(
                    <line
                      key={`dotted-${personId}-${i}`}
                      x1={lineStartX}
                      y1={lineY}
                      x2={lineEndX}
                      y2={lineY}
                      stroke="#6b7280"
                      strokeWidth="2"
                      strokeDasharray="8 6"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                  );
                }
              });
              
              return dottedConnections;
            })()}

            {/* Render couple units */}
            {coupleUnits.map((couple) => {
              const person1 = couple.person1;
              const person2 = couple.person2;
              const couplePos = getCouplePosition(couple.id);
              if (!couplePos) return null;
              
              const baseX = couplePos.x;
              const baseY = couplePos.y;
            
              const isSelected1 = selectedPersonId === person1.id;
              const isSelected2 = selectedPersonId === person2.id;
              const displayName1 = getFullName(person1);
              const displayName2 = getFullName(person2);
              
              const HALF_WIDTH = 70;
              const HALF_HEIGHT = 80;
              const GAP = 4;
              
              const leftColor = person1.gender === "male" ? "url(#maleGradient)" : 
                               person1.gender === "female" ? "url(#femaleGradient)" : "url(#nodeGradient)";
              const rightColor = person2.gender === "male" ? "url(#maleGradient)" : 
                                person2.gender === "female" ? "url(#femaleGradient)" : "url(#nodeGradient)";
              const leftStroke = person1.gender === "male" ? "#0369a1" : 
                                person1.gender === "female" ? "#be185d" : "#047857";
              const rightStroke = person2.gender === "male" ? "#0369a1" : 
                                 person2.gender === "female" ? "#be185d" : "#047857";
              
              return (
                <g
                  key={`couple-${couple.id}`}
                  transform={`translate(${baseX}, ${baseY})`}
                >
                  {/* Left half - person1 */}
                  <g
                    transform={`translate(${-HALF_WIDTH / 2 - GAP / 2}, 0)`}
                    onMouseDown={(e) => handleMouseDown(e, person1.id)}
                    onDoubleClick={(e) => handleNodeDoubleClick(e, person1, person2.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={-HALF_WIDTH / 2}
                      y={-HALF_HEIGHT / 2}
                      width={HALF_WIDTH}
                      height={HALF_HEIGHT}
                      rx="12"
                      fill={isSelected1 ? "url(#selectedGradient)" : leftColor}
                      filter="url(#shadow)"
                      stroke={isSelected1 ? "#fbbf24" : leftStroke}
                      strokeWidth={isSelected1 ? 3 : 2}
                    />
                    <circle cx={0} cy={-10} r={20} fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
                    <path d="M0 -16 a6 6 0 1 0 0.001 0 M-10 2 a14 10 0 0 1 20 0" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" />
                    <text y={HALF_HEIGHT / 2 - 8} textAnchor="middle" fill="white" fontSize="10" fontWeight="500" style={{ userSelect: "none" }}>
                      {displayName1.length > 10 ? displayName1.slice(0, 9) + "…" : displayName1}
                    </text>
                    <title>Double-click to edit {displayName1}</title>
                  </g>

                  {/* Right half - person2 */}
                  <g
                    transform={`translate(${HALF_WIDTH / 2 + GAP / 2}, 0)`}
                    onMouseDown={(e) => handleMouseDown(e, person2.id)}
                    onDoubleClick={(e) => handleNodeDoubleClick(e, person2, person1.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={-HALF_WIDTH / 2}
                      y={-HALF_HEIGHT / 2}
                      width={HALF_WIDTH}
                      height={HALF_HEIGHT}
                      rx="12"
                      fill={isSelected2 ? "url(#selectedGradient)" : rightColor}
                      filter="url(#shadow)"
                      stroke={isSelected2 ? "#fbbf24" : rightStroke}
                      strokeWidth={isSelected2 ? 3 : 2}
                    />
                    <circle cx={0} cy={-10} r={20} fill="rgba(255,255,255,0.3)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
                    <path d="M0 -16 a6 6 0 1 0 0.001 0 M-10 2 a14 10 0 0 1 20 0" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" />
                    <text y={HALF_HEIGHT / 2 - 8} textAnchor="middle" fill="white" fontSize="10" fontWeight="500" style={{ userSelect: "none" }}>
                      {displayName2.length > 10 ? displayName2.slice(0, 9) + "…" : displayName2}
                    </text>
                    <title>Double-click to edit {displayName2}</title>
                  </g>
                </g>
              );
            })}
          </>
        );
      })()}      {/* Single person nodes (no spouse) */}
      {layout.nodes.map((node) => {
        // Skip if this person is part of any couple
        if (personInCouple.has(node.id)) return null;

        const isSelected = selectedPersonId === node.id;
        const pos = node.computedPosition;
        const displayName = getFullName(node);

        // Single person node (no spouse)
        const nodeColor = node.gender === "male" ? "url(#maleGradient)" : 
                         node.gender === "female" ? "url(#femaleGradient)" : "url(#nodeGradient)";
        const nodeStroke = node.gender === "male" ? "#0369a1" : 
                          node.gender === "female" ? "#be185d" : "#047857";

        return (
          <g
            key={node.id}
            transform={`translate(${pos.x}, ${pos.y})`}
            onMouseDown={(e) => handleMouseDown(e, node.id)}
            onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
            style={{ cursor: "pointer" }}
          >
            {/* Node shadow and circle */}
            <circle
              r={NODE_RADIUS}
              fill={isSelected ? "url(#selectedGradient)" : nodeColor}
              filter="url(#shadow)"
              stroke={isSelected ? "#fbbf24" : nodeStroke}
              strokeWidth={isSelected ? 4 : 2}
            />

            {/* Avatar image or placeholder */}
            {node.avatarUrl ? (
              <g clipPath="url(#avatarClip)">
                <image
                  href={node.avatarUrl}
                  x={-(NODE_RADIUS - 3)}
                  y={-(NODE_RADIUS - 3)}
                  width={(NODE_RADIUS - 3) * 2}
                  height={(NODE_RADIUS - 3) * 2}
                  preserveAspectRatio="xMidYMid slice"
                />
              </g>
            ) : (
              /* Avatar placeholder - user silhouette */
              <g>
                {/* Head */}
                <circle
                  cx={0}
                  cy={-8}
                  r={14}
                  fill="rgba(255,255,255,0.3)"
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="2"
                />
                {/* User icon */}
                <path
                  d="M0 -14 a8 8 0 1 0 0.001 0 M-14 10 a18 12 0 0 1 28 0"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </g>
            )}

            {/* Name label */}
            <text
              y={NODE_RADIUS + 18}
              textAnchor="middle"
              fill="#1f2937"
              fontSize="13"
              fontWeight="500"
              style={{ userSelect: "none" }}
            >
              {displayName}
            </text>
            
            {/* Birth/Death years if available */}
            {(node.birth?.date || node.death?.date) && (
              <text
                y={NODE_RADIUS + 32}
                textAnchor="middle"
                fill="#6b7280"
                fontSize="10"
                style={{ userSelect: "none" }}
              >
                {node.birth?.date?.slice(0, 4) || "?"} - {node.death?.date?.slice(0, 4) || (node.death ? "?" : "")}
              </text>
            )}

            {/* Double-click hint */}
            <title>Double-click to edit</title>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Person } from "@/lib/types";
import { select } from "d3-selection";
import { zoom, zoomIdentity, ZoomBehavior } from "d3-zoom";

export interface DonatsoChartProps {
  people: Person[];
  selectedPersonId: string | null;
  onSelectPerson: (person: Person | null) => void;
}

// Generate default avatar SVG as data URL based on gender and name
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
  generation: number;
  avatar: string;
  displayName: string;
}

interface LayoutLink {
  sourceId: string;
  targetId: string;
  type: "parent-child" | "spouse";
}

// Build tree layout with proper vertical hierarchy
function buildLayout(people: Person[], focusedPersonId?: string | null): { nodes: LayoutNode[]; links: LayoutLink[] } {
  if (people.length === 0) return { nodes: [], links: [] };

  const personMap = new Map(people.map(p => [p.id, p]));

  // Filter relevant people if focused - show only direct lineage
  let relevantPeople = people;
  if (focusedPersonId) {
    const focused = personMap.get(focusedPersonId);
    if (focused) {
      const relevantIds = new Set<string>([focusedPersonId]);
      
      // Add spouses of focused person
      focused.spouseIds.forEach(id => relevantIds.add(id));
      
      // Add children of focused person
      focused.childIds.forEach(id => relevantIds.add(id));
      
      // Add ancestors (parents, grandparents, etc.) going up
      const addAncestors = (personId: string) => {
        const person = personMap.get(personId);
        if (!person) return;
        
        person.parentIds.forEach(parentId => {
          if (!relevantIds.has(parentId)) {
            relevantIds.add(parentId);
            // Add parent's spouse (other parent)
            const parent = personMap.get(parentId);
            if (parent) {
              parent.spouseIds.forEach(spouseId => {
                // Only add if they share parenthood (are parents of focused)
                if (focused.parentIds.includes(spouseId)) {
                  relevantIds.add(spouseId);
                }
              });
            }
            // Continue up the tree
            addAncestors(parentId);
          }
        });
      };
      
      addAncestors(focusedPersonId);
      
      // Add descendants (grandchildren, etc.) going down
      const addDescendants = (personId: string) => {
        const person = personMap.get(personId);
        if (!person) return;
        
        person.childIds.forEach(childId => {
          if (!relevantIds.has(childId)) {
            relevantIds.add(childId);
            // Add child's spouse
            const child = personMap.get(childId);
            if (child) {
              child.spouseIds.forEach(spouseId => relevantIds.add(spouseId));
            }
            // Continue down the tree
            addDescendants(childId);
          }
        });
      };
      
      addDescendants(focusedPersonId);
      
      relevantPeople = people.filter(p => relevantIds.has(p.id));
    }
  }

  const relevantMap = new Map(relevantPeople.map(p => [p.id, p]));

  // Calculate generations - parents always above children
  const generations = new Map<string, number>();
  
  // Find true roots (no parents in our dataset)
  const findRoots = () => {
    return relevantPeople.filter(p => 
      !p.parentIds.some(pid => relevantMap.has(pid))
    );
  };

  // Assign generations using iterative approach
  const roots = findRoots();
  
  // Initialize roots at generation 0
  roots.forEach(r => generations.set(r.id, 0));

  // Propagate generations downward
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 100) {
    changed = false;
    iterations++;
    
    relevantPeople.forEach(person => {
      // If person has parents with assigned generations, set their generation
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
      
      // Spouses should be at the same generation
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

  // Assign generation 0 to any remaining unassigned
  relevantPeople.forEach(p => {
    if (!generations.has(p.id)) {
      generations.set(p.id, 0);
    }
  });

  // Group by generation
  const genGroups = new Map<number, Person[]>();
  relevantPeople.forEach(person => {
    const gen = generations.get(person.id) || 0;
    if (!genGroups.has(gen)) genGroups.set(gen, []);
    genGroups.get(gen)!.push(person);
  });

  // Sort generations (0 is top)
  const sortedGens = Array.from(genGroups.keys()).sort((a, b) => a - b);

  // Layout constants
  const NODE_SPACING = 130;
  const SPOUSE_GAP = 90;
  const LEVEL_HEIGHT = 150;

  const nodes: LayoutNode[] = [];
  const nodePositions = new Map<string, { x: number; y: number }>();

  // Position each generation
  sortedGens.forEach((gen, genIndex) => {
    const genPeople = genGroups.get(gen)!;
    
    // Sort to keep couples together and order by parent position
    const positioned = new Set<string>();
    const ordered: Person[] = [];

    // First pass: group couples
    genPeople.forEach(person => {
      if (positioned.has(person.id)) return;
      
      ordered.push(person);
      positioned.add(person.id);
      
      // Add spouse right after
      person.spouseIds.forEach(spouseId => {
        const spouse = genPeople.find(p => p.id === spouseId);
        if (spouse && !positioned.has(spouseId)) {
          ordered.push(spouse);
          positioned.add(spouseId);
        }
      });
    });

    // Calculate x positions
    let currentX = 0;
    ordered.forEach((person, idx) => {
      const prev = idx > 0 ? ordered[idx - 1] : null;
      const isSpouseOfPrev = prev && person.spouseIds.includes(prev.id);
      
      if (idx > 0) {
        currentX += isSpouseOfPrev ? SPOUSE_GAP : NODE_SPACING;
      }
      
      nodePositions.set(person.id, { x: currentX, y: genIndex * LEVEL_HEIGHT });
    });
  });

  // Center horizontally
  const allX = Array.from(nodePositions.values()).map(p => p.x);
  const minX = Math.min(...allX, 0);
  const maxX = Math.max(...allX, 0);
  const centerOffset = (minX + maxX) / 2;

  // Create node objects
  relevantPeople.forEach(person => {
    const pos = nodePositions.get(person.id);
    if (!pos) return;

    const displayName = person.givenName || person.name || "Unknown";
    const avatar = person.avatarUrl || getDefaultAvatar(displayName, person.gender);

    nodes.push({
      id: person.id,
      person,
      x: pos.x - centerOffset,
      y: pos.y,
      generation: generations.get(person.id) || 0,
      avatar,
      displayName,
    });
  });

  // Create links
  const links: LayoutLink[] = [];
  const addedLinks = new Set<string>();
  const nodeIds = new Set(nodes.map(n => n.id));

  relevantPeople.forEach(person => {
    if (!nodeIds.has(person.id)) return;

    // Parent-child links
    person.parentIds.forEach(parentId => {
      if (!nodeIds.has(parentId)) return;
      const key = `pc-${parentId}-${person.id}`;
      if (!addedLinks.has(key)) {
        links.push({ sourceId: parentId, targetId: person.id, type: "parent-child" });
        addedLinks.add(key);
      }
    });

    // Spouse links
    person.spouseIds.forEach(spouseId => {
      if (!nodeIds.has(spouseId)) return;
      const key1 = `sp-${person.id}-${spouseId}`;
      const key2 = `sp-${spouseId}-${person.id}`;
      if (!addedLinks.has(key1) && !addedLinks.has(key2)) {
        links.push({ sourceId: person.id, targetId: spouseId, type: "spouse" });
        addedLinks.add(key1);
        addedLinks.add(key2);
      }
    });
  });

  return { nodes, links };
}

export function DonatsoChart({
  people,
  selectedPersonId,
  onSelectPerson,
}: DonatsoChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);

  const renderChart = useCallback(() => {
    if (!containerRef.current || people.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Clear previous
    select(container).selectAll("*").remove();

    // Create SVG
    const svg = select(container)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background", "#f9fafb");

    // Main group for zoom/pan
    const g = svg.append("g").attr("class", "main-group");

    // Zoom behavior
    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2.5])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);

    // Build layout
    const { nodes, links } = buildLayout(people, focusedPersonId);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    if (nodes.length === 0) return;

    // Calculate bounds and center
    const minX = Math.min(...nodes.map(n => n.x));
    const maxX = Math.max(...nodes.map(n => n.x));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxY = Math.max(...nodes.map(n => n.y));
    
    const treeWidth = maxX - minX + 200;
    const treeHeight = maxY - minY + 200;
    
    const scale = Math.min(width / treeWidth, height / treeHeight, 1) * 0.85;
    const centerX = width / 2;
    const centerY = height / 2 - ((minY + maxY) / 2) * scale + 30;
    
    svg.call(zoomBehavior.transform, zoomIdentity.translate(centerX, centerY).scale(scale));

    const NODE_RADIUS = 40;

    // Draw links
    const linksGroup = g.append("g").attr("class", "links");

    // Parent-child curved links
    linksGroup.selectAll(".parent-link")
      .data(links.filter(l => l.type === "parent-child"))
      .enter()
      .append("path")
      .attr("class", "parent-link")
      .attr("d", (d) => {
        const source = nodeMap.get(d.sourceId);
        const target = nodeMap.get(d.targetId);
        if (!source || !target) return "";
        
        const sy = source.y + NODE_RADIUS;
        const ty = target.y - NODE_RADIUS;
        const midY = (sy + ty) / 2;
        
        return `M ${source.x} ${sy} C ${source.x} ${midY}, ${target.x} ${midY}, ${target.x} ${ty}`;
      })
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 2.5)
      .attr("opacity", 0)
      .each(function(d, i) {
        const path = select(this);
        const length = (this as SVGPathElement).getTotalLength();
        path
          .attr("stroke-dasharray", length)
          .attr("stroke-dashoffset", length)
          .attr("opacity", 1);
        
        // Animate the line drawing
        setTimeout(() => {
          let start: number | null = null;
          const duration = 600;
          const animate = (timestamp: number) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            path.attr("stroke-dashoffset", length * (1 - progress));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }, 200 + i * 50);
      });

    // Spouse dashed links
    linksGroup.selectAll(".spouse-link")
      .data(links.filter(l => l.type === "spouse"))
      .enter()
      .append("line")
      .attr("class", "spouse-link")
      .attr("x1", d => nodeMap.get(d.sourceId)?.x || 0)
      .attr("y1", d => nodeMap.get(d.sourceId)?.y || 0)
      .attr("x2", d => nodeMap.get(d.sourceId)?.x || 0)
      .attr("y2", d => nodeMap.get(d.sourceId)?.y || 0)
      .attr("stroke", "#f472b6")
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "8,5")
      .each(function(d, i) {
        const line = select(this);
        const target = nodeMap.get(d.targetId);
        if (!target) return;
        
        // Animate spouse line
        setTimeout(() => {
          let start: number | null = null;
          const duration = 400;
          const sx = nodeMap.get(d.sourceId)?.x || 0;
          const sy = nodeMap.get(d.sourceId)?.y || 0;
          const animate = (timestamp: number) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease out
            line
              .attr("x2", sx + (target.x - sx) * eased)
              .attr("y2", sy + (target.y - sy) * eased);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }, 300 + i * 80);
      });

    // Define clip paths
    const defs = svg.append("defs");
    nodes.forEach(node => {
      defs.append("clipPath")
        .attr("id", `clip-${node.id}`)
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
      .style("cursor", "pointer")
      .style("opacity", 0);

    // Circle background
    nodeGroups.append("circle")
      .attr("class", "node-bg")
      .attr("r", 0)
      .attr("fill", "#ffffff")
      .attr("stroke", d => {
        if (d.id === focusedPersonId) return "#f59e0b";
        if (d.id === selectedPersonId) return "#16a34a";
        return d.person.gender === "female" ? "#ec4899" : "#3b82f6";
      })
      .attr("stroke-width", d => (d.id === selectedPersonId || d.id === focusedPersonId) ? 4 : 3);

    // Profile image
    nodeGroups.append("image")
      .attr("class", "node-img")
      .attr("x", -NODE_RADIUS + 3)
      .attr("y", -NODE_RADIUS + 3)
      .attr("width", (NODE_RADIUS - 3) * 2)
      .attr("height", (NODE_RADIUS - 3) * 2)
      .attr("clip-path", d => `url(#clip-${d.id})`)
      .attr("preserveAspectRatio", "xMidYMid slice")
      .attr("href", d => d.avatar)
      .style("opacity", 0);

    // Name tooltip
    const tooltips = nodeGroups.append("g")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("pointer-events", "none");

    tooltips.append("rect")
      .attr("x", d => -(d.displayName.length * 4 + 16))
      .attr("y", NODE_RADIUS + 10)
      .attr("width", d => d.displayName.length * 8 + 32)
      .attr("height", 30)
      .attr("rx", 8)
      .attr("fill", "#1f2937");

    tooltips.append("text")
      .attr("x", 0)
      .attr("y", NODE_RADIUS + 30)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "600")
      .attr("fill", "#ffffff")
      .text(d => d.displayName);

    // Animate nodes appearing
    nodeGroups.each(function(d, i) {
      const node = select(this);
      const circle = node.select(".node-bg");
      const img = node.select(".node-img");
      
      setTimeout(() => {
        node.style("opacity", 1);
        
        // Animate circle growing
        let start: number | null = null;
        const duration = 400;
        const animate = (timestamp: number) => {
          if (!start) start = timestamp;
          const progress = Math.min((timestamp - start) / duration, 1);
          // Bounce easing
          const eased = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          const overshoot = progress < 0.7 ? eased * 1.1 : 1 + (1 - progress) * 0.3 * (progress > 0.85 ? 0 : 1);
          const r = NODE_RADIUS * Math.min(overshoot, 1.08);
          circle.attr("r", r);
          if (progress >= 0.3) {
            img.style("opacity", Math.min((progress - 0.3) / 0.3, 1));
          }
          if (progress < 1) requestAnimationFrame(animate);
          else circle.attr("r", NODE_RADIUS);
        };
        requestAnimationFrame(animate);
      }, i * 100);
    });

    // Show All button when focused
    if (focusedPersonId) {
      const btn = svg.append("g")
        .attr("class", "show-all-btn")
        .attr("transform", `translate(${width - 110}, 20)`)
        .style("cursor", "pointer")
        .on("click", () => setFocusedPersonId(null));

      btn.append("rect")
        .attr("width", 100)
        .attr("height", 36)
        .attr("rx", 8)
        .attr("fill", "#3b82f6");

      btn.append("text")
        .attr("x", 50)
        .attr("y", 24)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("font-weight", "600")
        .attr("fill", "#ffffff")
        .text("Show All");
    }

    // Hover effects
    nodeGroups
      .on("mouseenter", function() {
        select(this).select(".node-bg").attr("r", NODE_RADIUS + 5);
        select(this).select(".tooltip").style("opacity", 1);
      })
      .on("mouseleave", function() {
        select(this).select(".node-bg").attr("r", NODE_RADIUS);
        select(this).select(".tooltip").style("opacity", 0);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        onSelectPerson(d.person);
      })
      .on("dblclick", (event, d) => {
        event.stopPropagation();
        setFocusedPersonId(prev => prev === d.id ? null : d.id);
      });

    // Click background to deselect
    svg.on("click", () => onSelectPerson(null));

  }, [people, selectedPersonId, focusedPersonId, onSelectPerson]);

  useEffect(() => {
    if (people.length === 0) {
      if (containerRef.current) {
        select(containerRef.current).selectAll("*").remove();
      }
      return;
    }

    renderChart();

    const handleResize = () => renderChart();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [people, selectedPersonId, focusedPersonId, renderChart]);

  if (people.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <p>Add family members to see the animated chart</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: "500px", overflow: "hidden" }}
    />
  );
}


import { useMemo, forwardRef, useState, useCallback, useEffect, useRef } from 'react';

export interface SankeyConfig {
    fontSizeTitle: number;
    fontSizeFlow: number;
    fontSizeDirect: number;
    fontSizeUpstream: number;
    boxSize: number;
    boxHeight: number;
    layerGap: number;
    headerRatio: number;
    contentRatio: number;
    startColor: string;
    endColor: string;
    opacity: number;
    theme: 'futuristic' | 'scientific';
    impactUnit?: string;
    minContribution: number;
    maxProcesses: number;
    orientation: 'north' | 'south' | 'east' | 'west';
    connectionStyle: 'curve' | 'straight';
}

interface SankeyNode {
    name: string;
    flowName?: string;
    direct?: number;
    upstream?: number;
    directPct?: number;
    upstreamPct?: number;
    processId?: string;
    isRoot?: boolean;
}

interface SankeyLink {
    source: number;
    target: number;
    value: number;
    share?: number;
}

interface SankeyProps {
    data: {
        nodes: SankeyNode[];
        links: SankeyLink[];
        totalImpact?: number;
        impactUnit?: string;
        impactCategory?: string;
        rootIndex?: number;
    };
    width: number;
    height: number;
    config: SankeyConfig;
}

interface NodePos { x: number; y: number; level: number }

function buildTree(nodes: SankeyNode[], links: SankeyLink[], rootIndex?: number) {
    let rootIdx = rootIndex ?? 0;
    if (rootIndex === undefined || rootIndex === null) {
        const sourceSet = new Set(links.map(l => l.source));
        const targetSet = new Set(links.map(l => l.target));
        for (let i = 0; i < nodes.length; i++) {
            if (!sourceSet.has(i) && targetSet.has(i)) {
                rootIdx = i;
                break;
            }
        }
    }

    const children: Map<number, { idx: number, value: number, share: number }[]> = new Map();
    links.forEach(l => {
        if (!children.has(l.target)) children.set(l.target, []);
        children.get(l.target)!.push({ idx: l.source, value: l.value, share: l.share || 0 });
    });

    return { rootIdx, children };
}

function computeLayout(
    nodes: SankeyNode[],
    rootIdx: number,
    children: Map<number, { idx: number; value: number }[]>,
    _width: number, _height: number,
    nodeWidth: number, nodeHeight: number,
    orientation: string,
    layerGap: number
): Map<number, NodePos> {
    const positions = new Map<number, NodePos>();
    const levelNodes = new Map<number, number[]>();

    const queue: { idx: number; level: number }[] = [{ idx: rootIdx, level: 0 }];
    const visited = new Set<number>();

    while (queue.length > 0) {
        const { idx, level } = queue.shift()!;
        if (visited.has(idx)) continue;
        visited.add(idx);
        if (!levelNodes.has(level)) levelNodes.set(level, []);
        levelNodes.get(level)!.push(idx);
        (children.get(idx) || []).forEach(c => {
            if (!visited.has(c.idx)) queue.push({ idx: c.idx, level: level + 1 });
        });
    }

    const siblingGap = 40;
    const isVertical = orientation === 'north' || orientation === 'south';

    if (isVertical) {
        const levelStep = nodeHeight + layerGap;
        levelNodes.forEach((nodesAtLevel, level) => {
            // Sort by upstream contribution (descending) to keep main path centered
            const sorted = [...nodesAtLevel].sort((a, b) => {
                const upstreamA = nodes[a]?.upstreamPct ?? 0;
                const upstreamB = nodes[b]?.upstreamPct ?? 0;
                return upstreamB - upstreamA; // Highest contribution first
            });

            // Arrange nodes with highest in center, alternating left/right
            const arranged: number[] = [];
            sorted.forEach((nodeIdx, i) => {
                if (i % 2 === 0) {
                    arranged.push(nodeIdx); // Even indices go to the right side
                } else {
                    arranged.unshift(nodeIdx); // Odd indices go to the left side
                }
            });

            const totalWidth = arranged.length * nodeWidth + (arranged.length - 1) * siblingGap;
            const startX = -totalWidth / 2;
            const yDir = orientation === 'north' ? 1 : -1;
            const yPos = level * levelStep * yDir;
            arranged.forEach((nodeIdx, i) => {
                positions.set(nodeIdx, { x: startX + i * (nodeWidth + siblingGap), y: yPos, level });
            });
        });
    } else {
        const levelStep = nodeWidth + layerGap;
        levelNodes.forEach((nodesAtLevel, level) => {
            // Sort by upstream contribution (descending) to keep main path centered
            const sorted = [...nodesAtLevel].sort((a, b) => {
                const upstreamA = nodes[a]?.upstreamPct ?? 0;
                const upstreamB = nodes[b]?.upstreamPct ?? 0;
                return upstreamB - upstreamA; // Highest contribution first
            });

            // Arrange nodes with highest in center, alternating top/bottom
            const arranged: number[] = [];
            sorted.forEach((nodeIdx, i) => {
                if (i % 2 === 0) {
                    arranged.push(nodeIdx); // Even indices go to the bottom side
                } else {
                    arranged.unshift(nodeIdx); // Odd indices go to the top side
                }
            });

            const totalHeight = arranged.length * nodeHeight + (arranged.length - 1) * siblingGap;
            const startY = -totalHeight / 2;
            const xDir = orientation === 'west' ? 1 : -1;
            const xPos = level * levelStep * xDir;
            arranged.forEach((nodeIdx, i) => {
                positions.set(nodeIdx, { x: xPos, y: startY + i * (nodeHeight + siblingGap), level });
            });
        });
    }

    return positions;
}

const formatVal = (v: number | undefined) => {
    if (v === undefined || v === null) return '0.000';
    const absV = Math.abs(v);
    
    // Scientific notation for very small numbers
    if (absV > 0 && absV < 0.001) {
        return v.toExponential(3);
    }
    
    // Scientific notation for very large numbers
    if (absV >= 1e6) {
        return v.toExponential(3);
    }
    
    // Zero or very close to zero
    if (absV < 1e-10) return '0.000';
    
    // Regular formatting for intermediate values
    if (absV >= 1) return v.toFixed(3);
    return v.toFixed(4);
};

const formatPct = (v: number | undefined) => {
    if (v === undefined || v === null) return '0.000';
    return v.toFixed(3);
};

/** Word-wrap text into lines that fit within maxWidth (px) for a given fontSize.
 *  Uses average char width ≈ fontSize × 0.6 for Arial. */
function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
    if (!text) return [];
    const avgCharW = fontSize * 0.6;
    const maxChars = Math.max(4, Math.floor(maxWidth / avgCharW));
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
        if (cur.length === 0) {
            cur = word;
        } else if ((cur + ' ' + word).length <= maxChars) {
            cur += ' ' + word;
        } else {
            lines.push(cur);
            cur = word;
        }
    }
    if (cur) lines.push(cur);
    // If a single word is longer than maxChars, it stays on its own line (no truncation)
    return lines;
}

const SankeyDiagram = forwardRef<SVGSVGElement, SankeyProps>(({ data, width, height, config }, ref) => {
    // Canvas pan/zoom
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });

    // Node dragging
    const [draggingNode, setDraggingNode] = useState<number | null>(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    // Editable node positions stored in state so dragging triggers re-render
    const [nodePositions, setNodePositions] = useState<Map<number, NodePos>>(new Map());

    // Compute tree structure (stable across drags)
    const treeInfo = useMemo(() => {
        const nodeHeight = Math.max(60, config.boxHeight);
        const nodeWidth = Math.max(150, config.boxSize);

        if (!data || data.nodes.length === 0) return null;
        if (data.links.length === 0 && data.nodes.length === 1) {
            return { rootIdx: 0, children: new Map<number, { idx: number; value: number; share: number }[]>(), nodeWidth, nodeHeight, singleNode: true };
        }
        if (data.links.length === 0) return null;
        const { rootIdx, children } = buildTree(data.nodes, data.links, data.rootIndex);
        return { rootIdx, children, nodeWidth, nodeHeight, singleNode: false };
    }, [data, config.boxSize, config.boxHeight]);

    // Track data identity so we only reset pan/zoom on new graph, not config tweaks
    const prevDataRef = useRef(data);

    // Recompute layout when data/orientation/size changes, store in state
    useEffect(() => {
        if (!treeInfo) { setNodePositions(new Map()); return; }
        const { nodeWidth: nw, nodeHeight: nh } = treeInfo;

        if (treeInfo.singleNode) {
            const pos = new Map<number, NodePos>();
            pos.set(0, { x: 0, y: 0, level: 0 });
            setNodePositions(pos);
            setTransform({ x: (width - nw) / 2, y: (height - nh) / 2, scale: 1 });
            return;
        }
        const positions = computeLayout(
            data.nodes, treeInfo.rootIdx, treeInfo.children,
            width, height, nw, nh,
            config.orientation, config.layerGap
        );
        setNodePositions(positions);

        // Compute bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        positions.forEach((pos) => {
            if (pos.x < minX) minX = pos.x;
            if (pos.y < minY) minY = pos.y;
            if (pos.x + nw > maxX) maxX = pos.x + nw;
            if (pos.y + nh > maxY) maxY = pos.y + nh;
        });
        if (minX !== Infinity) {
            const cw = maxX - minX;
            const ch = maxY - minY;
            const pad = 30;
            const sx = (width - pad * 2) / cw;
            const sy = (height - pad * 2) / ch;
            const s = Math.max(0.1, Math.min(sx, sy, 1.5));
            const cx = minX + cw / 2;
            const cy = minY + ch / 2;
            setTransform({ x: width / 2 - cx * s, y: height / 2 - cy * s, scale: s });
        } else {
            setTransform({ x: 0, y: 0, scale: 1 });
        }
        if (prevDataRef.current !== data) {
            prevDataRef.current = data;
        }
    }, [data, width, height, config.orientation, config.boxSize, config.boxHeight, config.layerGap, treeInfo]);

    // --- Mouse handlers ---
    const svgToWorld = useCallback((clientX: number, clientY: number, svgEl: SVGSVGElement) => {
        const rect = svgEl.getBoundingClientRect();
        return {
            x: (clientX - rect.left - transform.x) / transform.scale,
            y: (clientY - rect.top - transform.y) / transform.scale,
        };
    }, [transform]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setTransform(t => ({
            ...t,
            scale: Math.max(0.1, Math.min(5, t.scale * delta))
        }));
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        // Only pan if clicking on canvas background (not on a node)
        if ((e.target as SVGElement).closest('.sankey-node')) return;
        setIsPanning(true);
        panStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
    }, [transform]);

    const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (draggingNode !== null && treeInfo) {
            // Move node
            const svgEl = e.currentTarget;
            const world = svgToWorld(e.clientX, e.clientY, svgEl);
            setNodePositions(prev => {
                const next = new Map(prev);
                const old = next.get(draggingNode);
                next.set(draggingNode, {
                    x: world.x - dragOffsetRef.current.x,
                    y: world.y - dragOffsetRef.current.y,
                    level: old?.level ?? 0,
                });
                return next;
            });
            return;
        }
        if (isPanning) {
            setTransform(t => ({
                ...t,
                x: e.clientX - panStartRef.current.x,
                y: e.clientY - panStartRef.current.y,
            }));
        }
    }, [draggingNode, isPanning, svgToWorld, treeInfo]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
        setDraggingNode(null);
    }, []);

    const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeIdx: number) => {
        e.stopPropagation();
        const svgEl = (e.target as SVGElement).closest('svg') as SVGSVGElement;
        const world = svgToWorld(e.clientX, e.clientY, svgEl);
        const pos = nodePositions.get(nodeIdx);
        if (pos) {
            dragOffsetRef.current = { x: world.x - pos.x, y: world.y - pos.y };
        }
        setDraggingNode(nodeIdx);
    }, [svgToWorld, nodePositions]);

    if (!treeInfo || nodePositions.size === 0) {
        return <div style={{ width, height, background: '#fff', color: '#666', padding: 40, fontFamily: 'Arial', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>No data available. Select a product system, method, and impact category, then click Refresh.</div>;
    }

    const { children, nodeWidth, nodeHeight } = treeInfo;
    const linkColor = '#e91e63';
    const rootColor = '#1565c0';
    const unit = data.impactUnit || config.impactUnit || '';
    const isVertical = config.orientation === 'north' || config.orientation === 'south';

    // Partition heights driven by config ratios
    const headerH = Math.round(nodeHeight * config.headerRatio);
    const contentH = nodeHeight - headerH;
    const directH = Math.round(contentH * config.contentRatio);
    const upstreamH = contentH - directH;

    // Build link paths from current (potentially dragged) positions
    const MAX_STROKE = 40;
    const MIN_STROKE = 1.5;

    const paths: { d: string; weight: number; pct: number }[] = [];
    nodePositions.forEach((parentPos, parentIdx) => {
        (children.get(parentIdx) || []).forEach(child => {
            const childPos = nodePositions.get(child.idx);
            if (!childPos) return;

            const childNode = data.nodes[child.idx];
            const pct = childNode?.upstreamPct ?? 0;
            const fraction = Math.min(pct / 100, 1);

            let d: string;
            if (isVertical) {
                const x1 = parentPos.x + nodeWidth / 2;
                const y1 = config.orientation === 'north' ? parentPos.y + nodeHeight : parentPos.y;
                const x2 = childPos.x + nodeWidth / 2;
                const y2 = config.orientation === 'north' ? childPos.y : childPos.y + nodeHeight;
                if (config.connectionStyle === 'curve') {
                    const midY = (y1 + y2) / 2;
                    d = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
                } else {
                    d = `M${x1},${y1} L${x1},${(y1 + y2) / 2} L${x2},${(y1 + y2) / 2} L${x2},${y2}`;
                }
            } else {
                const x1 = config.orientation === 'west' ? parentPos.x + nodeWidth : parentPos.x;
                const y1 = parentPos.y + nodeHeight / 2;
                const x2 = config.orientation === 'west' ? childPos.x : childPos.x + nodeWidth;
                const y2 = childPos.y + nodeHeight / 2;
                if (config.connectionStyle === 'curve') {
                    const midX = (x1 + x2) / 2;
                    d = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
                } else {
                    d = `M${x1},${y1} L${(x1 + x2) / 2},${y1} L${(x1 + x2) / 2},${y2} L${x2},${y2}`;
                }
            }
            const weight = MIN_STROKE + fraction * (MAX_STROKE - MIN_STROKE);
            paths.push({ d, weight, pct });
        });
    });

    const cursorStyle = draggingNode !== null ? 'grabbing' : isPanning ? 'grabbing' : 'grab';

    return (
        <svg
            width={width}
            height={height}
            ref={ref}
            style={{ backgroundColor: '#fff', fontFamily: 'Arial, sans-serif', cursor: cursorStyle }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
                {/* Links */}
                <g fill="none">
                    {paths.map((p, i) => (
                        <path
                            key={i}
                            d={p.d}
                            stroke={linkColor}
                            strokeWidth={p.weight}
                            strokeOpacity={config.opacity}
                            strokeLinecap="round"
                        />
                    ))}
                </g>
                {/* Nodes */}
                <g>
                    {Array.from(nodePositions.entries()).map(([nodeIdx, pos]) => {
                        const node = data.nodes[nodeIdx];
                        if (!node) return null;
                        const isRoot = node.isRoot || nodeIdx === (data.rootIndex ?? treeInfo.rootIdx);
                        const borderColor = isRoot ? rootColor : linkColor;
                        const isDragging = draggingNode === nodeIdx;

                        return (
                            <g
                                key={nodeIdx}
                                className="sankey-node"
                                style={{ cursor: isDragging ? 'grabbing' : 'move' }}
                                onMouseDown={(e) => handleNodeMouseDown(e, nodeIdx)}
                            >
                                {/* Shadow */}
                                <rect x={pos.x + 2} y={pos.y + 2} width={nodeWidth} height={nodeHeight} fill="#00000012" rx={5} />
                                {/* Box background */}
                                <rect
                                    x={pos.x} y={pos.y} width={nodeWidth} height={nodeHeight}
                                    fill="#fff" stroke={isDragging ? '#333' : borderColor}
                                    strokeWidth={isDragging ? 2.5 : isRoot ? 2.5 : 1.5} rx={5}
                                />
                                {/* Header background */}
                                <rect x={pos.x} y={pos.y} width={nodeWidth} height={headerH} fill={`${borderColor}15`} rx={5} />
                                <rect x={pos.x} y={pos.y + headerH - 5} width={nodeWidth} height={5} fill={`${borderColor}15`} />
                                {/* Icon */}
                                <circle cx={pos.x + 15} cy={pos.y + headerH / 2} r={7} fill={borderColor} opacity={isRoot ? 0.7 : 0.4} />
                                {isRoot && (
                                    <text x={pos.x + 15} y={pos.y + headerH / 2 + 4} textAnchor="middle" fill="#fff" fontSize={9} fontWeight="bold">R</text>
                                )}
                                {/* Partition line between header and content */}
                                <line x1={pos.x} y1={pos.y + headerH} x2={pos.x + nodeWidth} y2={pos.y + headerH} stroke={borderColor} strokeOpacity={0.25} strokeWidth={1} />
                                {/* Partition line between direct and upstream */}
                                <line x1={pos.x + 8} y1={pos.y + headerH + directH} x2={pos.x + nodeWidth - 8} y2={pos.y + headerH + directH} stroke="#ccc" strokeOpacity={0.5} strokeWidth={0.5} strokeDasharray="3,2" />

                                {/* === Pure SVG text with <tspan> word wrapping === */}
                                {(() => {
                                    const textMaxW = nodeWidth - 36; // padding: 28px left + 8px right
                                    const titleLines = wrapText(node.name, config.fontSizeTitle, textMaxW);
                                    const flowLines = node.flowName ? wrapText(node.flowName, config.fontSizeFlow, textMaxW) : [];
                                    const titleLineH = config.fontSizeTitle * 1.25;
                                    const flowLineH = config.fontSizeFlow * 1.25;
                                    const totalTitleH = titleLines.length * titleLineH + flowLines.length * flowLineH;
                                    // Vertically center in header
                                    const titleStartY = pos.y + Math.max(4, (headerH - totalTitleH) / 2) + config.fontSizeTitle;

                                    const contentMaxW = nodeWidth - 20; // padding: 12px left + 8px right
                                    const directLabel = `Direct (${formatPct(node.directPct)}%):`;
                                    const directValue = `${formatVal(node.direct)} ${unit}`;
                                    const directLabelLines = wrapText(directLabel, config.fontSizeDirect, contentMaxW);
                                    const directValueLines = wrapText(directValue, config.fontSizeDirect, contentMaxW - 6);
                                    const directLineH = config.fontSizeDirect * 1.25;
                                    const totalDirectTextH = (directLabelLines.length + directValueLines.length) * directLineH;
                                    const directStartY = pos.y + headerH + Math.max(2, (directH - totalDirectTextH) / 2) + config.fontSizeDirect;

                                    const upLabel = `Upstream (${formatPct(node.upstreamPct)}%):`;
                                    const upValue = `${formatVal(node.upstream)} ${unit}`;
                                    const upLabelLines = wrapText(upLabel, config.fontSizeUpstream, contentMaxW);
                                    const upValueLines = wrapText(upValue, config.fontSizeUpstream, contentMaxW - 6);
                                    const upLineH = config.fontSizeUpstream * 1.25;
                                    const totalUpTextH = (upLabelLines.length + upValueLines.length) * upLineH;
                                    const upStartY = pos.y + headerH + directH + Math.max(2, (upstreamH - totalUpTextH) / 2) + config.fontSizeUpstream;

                                    return (
                                        <>
                                            {/* Title */}
                                            <text x={pos.x + 28} y={titleStartY} fill="#333" fontSize={config.fontSizeTitle} fontWeight="600" style={{ pointerEvents: 'none' }}>
                                                {titleLines.map((line, li) => (
                                                    <tspan key={li} x={pos.x + 28} dy={li === 0 ? 0 : titleLineH}>{line}</tspan>
                                                ))}
                                            </text>
                                            {/* Flow name */}
                                            {flowLines.length > 0 && (
                                                <text x={pos.x + 28} y={titleStartY + titleLines.length * titleLineH} fill="#888" fontSize={config.fontSizeFlow} fontStyle="italic" style={{ pointerEvents: 'none' }}>
                                                    {flowLines.map((line, li) => (
                                                        <tspan key={li} x={pos.x + 28} dy={li === 0 ? 1 : flowLineH}>{line}</tspan>
                                                    ))}
                                                </text>
                                            )}
                                            {/* Direct label */}
                                            <text x={pos.x + 12} y={directStartY} fill="#333" fontSize={config.fontSizeDirect} fontWeight="bold" style={{ pointerEvents: 'none' }}>
                                                {directLabelLines.map((line, li) => (
                                                    <tspan key={li} x={pos.x + 12} dy={li === 0 ? 0 : directLineH}>{line}</tspan>
                                                ))}
                                            </text>
                                            {/* Direct value */}
                                            <text x={pos.x + 18} y={directStartY + directLabelLines.length * directLineH} fill="#666" fontSize={config.fontSizeDirect} style={{ pointerEvents: 'none' }}>
                                                {directValueLines.map((line, li) => (
                                                    <tspan key={li} x={pos.x + 18} dy={li === 0 ? 0 : directLineH}>{line}</tspan>
                                                ))}
                                            </text>
                                            {/* Upstream label */}
                                            <text x={pos.x + 12} y={upStartY} fill="#333" fontSize={config.fontSizeUpstream} fontWeight="bold" style={{ pointerEvents: 'none' }}>
                                                {upLabelLines.map((line, li) => (
                                                    <tspan key={li} x={pos.x + 12} dy={li === 0 ? 0 : upLineH}>{line}</tspan>
                                                ))}
                                            </text>
                                            {/* Upstream value */}
                                            <text x={pos.x + 18} y={upStartY + upLabelLines.length * upLineH} fill="#666" fontSize={config.fontSizeUpstream} style={{ pointerEvents: 'none' }}>
                                                {upValueLines.map((line, li) => (
                                                    <tspan key={li} x={pos.x + 18} dy={li === 0 ? 0 : upLineH}>{line}</tspan>
                                                ))}
                                            </text>
                                        </>
                                    );
                                })()}
                            </g>
                        );
                    })}
                </g>
            </g>
            {/* Controls hint */}
            <text x={10} y={height - 10} fill="#999" fontSize={11}>
                Scroll to zoom • Drag canvas to pan • Drag nodes to reposition • Zoom: {(transform.scale * 100).toFixed(0)}%
            </text>
        </svg>
    );
});

export default SankeyDiagram;

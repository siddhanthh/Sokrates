'use client';

import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export interface ArgumentNodeData {
  id: string;
  type: 'claim' | 'evidence' | 'rebuttal' | 'concession' | 'agreement';
  participant: string;
  content: string;
  parent?: string | null;
  relation?: 'supports' | 'challenges' | 'partially_agrees' | 'acknowledges' | null;
}

export interface ArgumentMapViewerProps {
  data: {
    central_question: string;
    participants: Array<{ id: string; username: string; color: string }>;
    nodes: ArgumentNodeData[];
  };
}

const TYPE_STYLES: Record<string, { bg: string; border: string; badge: string; text: string }> = {
  claim: { bg: 'bg-indigo-900/60', border: 'border-indigo-500', badge: 'bg-indigo-600', text: 'Claim' },
  evidence: { bg: 'bg-emerald-900/60', border: 'border-emerald-500', badge: 'bg-emerald-600', text: 'Evidence' },
  rebuttal: { bg: 'bg-rose-900/60', border: 'border-rose-500', badge: 'bg-rose-600', text: 'Rebuttal' },
  concession: { bg: 'bg-amber-900/60', border: 'border-amber-500', badge: 'bg-amber-600', text: 'Concession' },
  agreement: { bg: 'bg-teal-900/60', border: 'border-teal-500', badge: 'bg-teal-600', text: 'Agreement' },
};

function CustomArgumentNode({ data }: { data: ArgumentNodeData & { participantName: string } }) {
  const style = TYPE_STYLES[data.type] || TYPE_STYLES.claim;

  return (
    <div
      className={`p-4 rounded-xl border ${style.border} ${style.bg} backdrop-blur-md shadow-lg max-w-sm text-white transition-all hover:scale-105`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${style.badge}`}>
          {style.text}
        </span>
        <span className="text-xs text-gray-300 font-medium">
          {data.participantName}
        </span>
      </div>
      <p className="text-sm font-normal text-gray-100 leading-relaxed">
        {data.content}
      </p>
    </div>
  );
}

const nodeTypes = {
  argumentNode: CustomArgumentNode,
};

export default function ArgumentMapViewer({ data }: ArgumentMapViewerProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) {
      return { initialNodes: [], initialEdges: [] };
    }

    const participantMap = new Map<string, string>();
    (data.participants || []).forEach((p) => participantMap.set(p.id, p.username));

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Layout configuration (Tree structure: X offset by level, Y offset by index)
    const levelCounts: Record<number, number> = {};

    data.nodes.forEach((n, idx) => {
      const pName = participantMap.get(n.participant) || n.participant || 'Participant';

      // Simple tree layout calculation
      const level = n.parent ? 1 + (data.nodes.findIndex((p) => p.id === n.parent) % 3) : 0;
      const count = levelCounts[level] || 0;
      levelCounts[level] = count + 1;

      const posX = level * 360 + 50;
      const posY = count * 180 + 50;

      nodes.push({
        id: n.id,
        type: 'argumentNode',
        position: { x: posX, y: posY },
        data: { ...n, participantName: pName },
      });

      if (n.parent) {
        const edgeColor =
          n.type === 'rebuttal'
            ? '#f43f5e'
            : n.type === 'evidence'
            ? '#10b981'
            : n.type === 'concession'
            ? '#f59e0b'
            : '#818cf8';

        edges.push({
          id: `e-${n.parent}-${n.id}`,
          source: n.parent,
          target: n.id,
          label: n.relation || undefined,
          type: 'smoothstep',
          animated: true,
          style: { stroke: edgeColor, strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
          },
        });
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [data]);

  return (
    <div className="w-full h-[650px] bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 bg-gray-900/80 backdrop-blur-md p-3 rounded-lg border border-gray-800 text-white">
        <h3 className="text-base font-bold text-indigo-400">
          {data?.central_question || 'Argument Analysis Graph'}
        </h3>
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Claim
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Evidence
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Rebuttal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Concession
          </span>
        </div>
      </div>

      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-950"
      >
        <Background color="#374151" gap={20} />
        <Controls className="bg-gray-900 text-white border-gray-800 fill-white" />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as any;
            if (data.type === 'rebuttal') return '#f43f5e';
            if (data.type === 'evidence') return '#10b981';
            if (data.type === 'concession') return '#f59e0b';
            return '#6366f1';
          }}
          className="bg-gray-900 border-gray-800 rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}

'use client';

import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

export default function ReactFlowTestPage() {
  const initialNodes: Node[] = [
    {
      id: 'A',
      data: { label: 'Visionary' },
      position: { x: 100, y: 80 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: { borderRadius: 8, padding: 8, background: '#fff' },
    },
    {
      id: 'B',
      data: { label: 'Integrator' },
      position: { x: 100, y: 240 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: { borderRadius: 8, padding: 8, background: '#fff' },
    },
    {
      id: 'C',
      data: { label: 'Marketing/Sales' },
      position: { x: -40, y: 400 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: { borderRadius: 8, padding: 8, background: '#fff' },
    },
    {
      id: 'D',
      data: { label: 'Operations' },
      position: { x: 120, y: 400 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: { borderRadius: 8, padding: 8, background: '#fff' },
    },
    {
      id: 'E',
      data: { label: 'Finance' },
      position: { x: 280, y: 400 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      style: { borderRadius: 8, padding: 8, background: '#fff' },
    },
  ];

  const initialEdges: Edge[] = [
    { id: 'A-B', source: 'A', target: 'B', type: 'smoothstep' },
    { id: 'B-C', source: 'B', target: 'C', type: 'smoothstep' },
    { id: 'B-D', source: 'B', target: 'D', type: 'smoothstep' },
    { id: 'B-E', source: 'B', target: 'E', type: 'smoothstep' },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = React.useCallback(
    (conn: Connection) =>
      setEdges((eds: Edge[]) => addEdge({ ...conn, type: 'smoothstep' }, eds)),
    [setEdges],
  );

  return (
    <div className="w-full" style={{ height: '80vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <MiniMap pannable zoomable />
        <Controls />
        <Background gap={16} />
      </ReactFlow>
    </div>
  );
}

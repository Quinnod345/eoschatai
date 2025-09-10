declare module 'reactflow' {
  const ReactFlow: any;
  export default ReactFlow;
  export const Background: any;
  export const Controls: any;
  export const MiniMap: any;
  export const Handle: any;
  export function addEdge(edge: any, edges: any): any;
  export function useEdgesState(initial: any): [any[], any, any];
  export function useNodesState(initial: any): [any[], any, any];
  export type Connection = any;
  export type Edge = any;
  export type Node = any;
  export enum Position {
    Left,
    Right,
    Top,
    Bottom,
  }
  export enum MarkerType {
    Arrow,
    ArrowClosed,
  }
}

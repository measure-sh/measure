"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppVersion, JourneyApiStatus, emptyJourney, fetchJourneyFromServer } from '../api/api_calls';
import Dagre from '@dagrejs/dagre';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Position,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface JourneyProps {
  appId: string,
  startDate: string,
  endDate: string,
  appVersion: AppVersion,
}

type Node = {
  id: string
  type: string | undefined
  width: number
  height: number
  position: { x: number, y: number }
  sourcePosition: Position | undefined
  targetPosition: Position | undefined
  data: {
    label: string
    issues: {
      crashes: { title: string; count: number }[];
      anrs: { title: string; count: number }[];
    }
  }
}

type Edge = {
  id: string
  source: string
  target: string
  sourceHandle: string
  style: {
    strokeWidth: number
    stroke: string
  }
  label: string
  animated: boolean
}

const nodeTypes = {
  measureNode: MeasureNode,
};

const formatter = Intl.NumberFormat('en', { notation: 'compact' });

{/* @ts-ignore */ }
function MeasureNode({ data, isConnectable }) {
  return (
    <div className={`group p-4 border-black rounded-md transition ease-in-out hover:-translate-y-1 hover:scale-110 duration-300 ${data.issues.crashes.length > 0 || data.issues.anrs.length > 0 ? 'bg-red-400' : 'bg-emerald-400'}`}>
      <Handle type="target" id="a" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" id="b" position={Position.Right} isConnectable={isConnectable} />
      <p className="font-sans text-white text-center group-hover:text-left">{data.label}</p>
      <div className='h-0 group-hover:h-full'>
        {data.issues.crashes.length > 0 && (
          <div>
            <div className="py-2" />
            <p className="font-sans text-white">Crashes:</p>
            <ul className="list-disc list-inside text-white p-2">
              {/* @ts-ignore */}
              {data.issues.crashes.map(({ title, count }) => (
                <li key={title}>
                  <span className="font-sans text-xs">
                    {title} - {formatter.format(count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.issues.anrs.length > 0 && (
          <div>
            <div className="py-2" />
            <p className="font-sans text-white">ANRs:</p>
            <ul className="list-disc list-inside text-white p-2">
              {/* @ts-ignore */}
              {data.issues.anrs.map(({ title, count }) => (
                <li key={title}>
                  <span className="font-sans text-xs">
                    {title} - {formatter.format(count)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const getReactFlowFromJourney = (journey: typeof emptyJourney) => {
  const nodes = journey.nodes.map(node => {
    const { id, nodeColor, issues } = node;
    return {
      id,
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      type: 'measureNode',
      sourcePosition: undefined,
      targetPosition: undefined,
      data: { label: id, issues: issues }
    };
  });

  const maxLinkValue = Math.max(...journey.links.map(link => link.value));
  const minLinkValue = Math.min(...journey.links.map(link => link.value));

  const edges = journey.links.map(link => {
    const { source, target, value } = link;
    const strokeWidth = 2 + ((value - minLinkValue) * 16) / (maxLinkValue - minLinkValue);

    return {
      id: source + '-' + target,
      source,
      target,
      style: {
        strokeWidth: strokeWidth,
        stroke: "#9CA3AF"
      },
      sourceHandle: 'b',
      label: formatter.format(value) + ' sessions',
      animated: true
    };
  });

  return {
    nodes,
    edges
  };
}

const dagreGraph = new Dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 100, edgesep: 200 });

  nodes.forEach((node) => dagreGraph.setNode(node.id, node));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));

  Dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Left;
    node.sourcePosition = Position.Right;
    node.position = {
      x: nodeWithPosition.x,
      y: nodeWithPosition.y
    };
    return node;
  });

  return { nodes, edges };
};

const Journey: React.FC<JourneyProps> = ({ appId, startDate, endDate, appVersion }) => {

  const [journeyApiStatus, setJourneyApiStatus] = useState(JourneyApiStatus.Loading);
  const [journey, setJourney] = useState(emptyJourney);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const router = useRouter()

  const getJourney = async (appId: string, startDate: string, endDate: string, appVersion: AppVersion) => {
    setJourneyApiStatus(JourneyApiStatus.Loading)

    const result = await fetchJourneyFromServer(appId, startDate, endDate, appVersion, router)

    switch (result.status) {
      case JourneyApiStatus.Error:
        setJourneyApiStatus(JourneyApiStatus.Error)
        break
      case JourneyApiStatus.Success:
        setJourneyApiStatus(JourneyApiStatus.Success)
        setJourney(result.data)
        let flow = getReactFlowFromJourney(result.data)
        const layoutedFlow = getLayoutedElements(flow.nodes as Node[], flow.edges as Edge[]);
        setNodes(layoutedFlow.nodes)
        setEdges(layoutedFlow.edges)
        break
    }
  }

  useEffect(() => {
    getJourney(appId, startDate, endDate, appVersion)
  }, [appId, startDate, endDate, appVersion]);

  return (
    <div className="flex items-center justify-center border border-black text-black font-sans text-sm w-5/6 h-screen">
      {journeyApiStatus === JourneyApiStatus.Loading && <p className="text-lg">Updating journey...</p>}
      {journeyApiStatus === JourneyApiStatus.Error && <p className="text-lg">Error fetching journey. Please refresh page or change filters to try again.</p>}
      {journeyApiStatus === JourneyApiStatus.Success
        && <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesDraggable={true}
          nodesConnectable={false}
          edgesUpdatable={false}
          proOptions={{ hideAttribution: true }}
          // @ts-ignore
          nodeTypes={nodeTypes}
          fitView
        />}
    </div>
  );
};

export default Journey;
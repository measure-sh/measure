"use client"

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppVersion, JourneyApiStatus, emptyJourney, fetchJourneyFromServer } from '../api/api_calls'
import Dagre from '@dagrejs/dagre'
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Position,
  Handle,
  Controls
} from 'reactflow'
import 'reactflow/dist/style.css'
import Link from 'next/link'

interface JourneyProps {
  teamId: string,
  appId: string,
  bidirectional: boolean,
  journeyType: JourneyType,
  exceptionsGroupId: string | null,
  startDate: string,
  endDate: string,
  appVersions: AppVersion[]
  countries: string[],
  networkProviders: string[],
  networkTypes: string[],
  networkGenerations: string[],
  locales: string[],
  deviceManufacturers: string[],
  deviceNames: string[]
}

export enum JourneyType {
  Overview,
  CrashDetails,
  AnrDetails
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
    label: string,
    teamId: string,
    appId: string,
    journeyType: JourneyType,
    startDate: string,
    endDate: string,
    issues: {
      crashes: { id: string, title: string; count: number }[]
      anrs: { id: string, title: string; count: number }[]
    },
    nodeIssueContribution: number
    isUpstream: boolean
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

const edgeColorDefault = '#b1b1b7'
const edgeColorHightlight = '#059669'
const edgeStrokeWidthDefault = 2
const edgeStrokeWidthHighlight = 4
const nodeColorPositive = '#10b981'
const nodeColorNegative = '#f87171'

const Journey: React.FC<JourneyProps> = ({ teamId, appId, bidirectional, journeyType, exceptionsGroupId, startDate, endDate, appVersions, countries, networkProviders, networkTypes, networkGenerations, locales, deviceManufacturers, deviceNames }) => {

  const [journeyApiStatus, setJourneyApiStatus] = useState(JourneyApiStatus.Loading)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const router = useRouter()
  const formatter = Intl.NumberFormat('en', { notation: 'compact' })

  const nodeTypes = useMemo(() => ({ measureNode: MeasureNode }), [])

  const dagreGraph = new Dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  const findUpstreamNodesAndEdges = useCallback((nodeId: string, edges: any[]) => {
    const upstreamNodes = new Set<string>()
    const upstreamEdges = new Set<string>()
    const visited = new Set<string>()

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return
      visited.add(currentId)

      edges.forEach(edge => {
        if (edge.target === currentId) {
          upstreamNodes.add(edge.source)
          upstreamEdges.add(edge.id)
          traverse(edge.source)
        }
      })
    }

    traverse(nodeId)
    return { upstreamNodes: Array.from(upstreamNodes), upstreamEdges: Array.from(upstreamEdges) }
  }, [])

  const onNodeMouseEnter = useCallback((event: any, node: { id: string }) => {
    const { upstreamNodes, upstreamEdges } = findUpstreamNodesAndEdges(node.id, edges)

    setNodes(currentNodes => currentNodes.map(currentNode => ({
      ...currentNode,
      data: {
        ...currentNode.data,
        isUpstream: upstreamNodes.includes(currentNode.id)
      }
    })))

    setEdges(currentEdges => currentEdges.map(edge => ({
      ...edge,
      style: {
        ...edge.style,
        stroke: upstreamEdges.includes(edge.id) ? edgeColorHightlight : edgeColorDefault,
        strokeWidth: upstreamEdges.includes(edge.id) ? edgeStrokeWidthHighlight : edgeStrokeWidthDefault,
      }
    })))
  }, [edges, findUpstreamNodesAndEdges])

  const onNodeMouseLeave = useCallback(() => {
    setNodes(currentNodes => currentNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isUpstream: false
      }
    })))

    setEdges(currentEdges => currentEdges.map(edge => ({
      ...edge,
      style: {
        ...edge.style,
        stroke: edgeColorDefault,
        strokeWidth: edgeStrokeWidthDefault,
      }
    })))
  }, [])

  {/* @ts-ignore */ }
  function MeasureNode({ data, isConnectable }) {
    const isNodeWithIssues = data.issues.crashes?.length > 0 || data.issues.anrs?.length > 0
    let nodeHeaderBgColour
    if (isNodeWithIssues) {
      const positivePercentage = isNodeWithIssues ? (1 - data.nodeIssueContribution) * 100 : 100
      const negativePercentage = isNodeWithIssues ? data.nodeIssueContribution * 100 : 0
      nodeHeaderBgColour = { background: `linear-gradient(to right, ${nodeColorPositive} ${positivePercentage}%, ${positivePercentage}%, ${nodeColorNegative} ${negativePercentage}%)` }
    } else {
      nodeHeaderBgColour = { background: nodeColorPositive }
    }

    return (
      <div className={`group border-black rounded-md transition ease-in-out duration-300 hover:-translate-y-1 hover:scale-110 ${data.isUpstream ? 'scale-110' : ''}`}>

        <Handle type="target" id="a" position={Position.Top} isConnectable={isConnectable} />
        <Handle type="source" id="b" position={Position.Bottom} isConnectable={isConnectable} />

        <div className='w-full p-4' style={nodeHeaderBgColour}>
          <p className="font-sans text-white w-full text-center">{data.label}</p>
        </div>

        <div className='h-0 rounded-b-md opacity-0 invisible bg-neutral-950 group-hover:pl-2 group-hover:pr-2 group-hover:opacity-100 group-hover:visible group-hover:h-full transition ease-in-out duration-300'>
          {data.issues.crashes?.length > 0 && (
            <div>
              <p className="font-sans text-white pt-2">Crashes:</p>
              <ul className="list-disc list-inside text-white pt-2 pb-4 pl-2 pr-2">
                {/* @ts-ignore */}
                {data.issues.crashes.map(({ id, title, count }) => (
                  <li key={title}>
                    {/* Show clickable link if overview journey type */}
                    {data.journeyType === JourneyType.Overview &&
                      <span className="font-sans text-xs">
                        <Link href={`/${data.teamId}/crashes/${data.appId}/${id}/${title}?start_date=${data.startDate}&end_date=${data.endDate}`} className="underline decoration-yellow-200 hover:decoration-yellow-500">
                          {title} - {formatter.format(count)}
                        </Link>
                      </span>
                    }
                    {/* Show only title and count if crash or anr journey type */}
                    {(data.journeyType === JourneyType.CrashDetails || data.journeyType === JourneyType.AnrDetails) &&
                      <span className="font-sans text-xs">
                        {title} - {formatter.format(count)}
                      </span>
                    }
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.issues.anrs?.length > 0 && (
            <div>
              <p className="font-sans text-white pt-2">ANRs:</p>
              <ul className="list-disc list-inside text-white pt-2 pb-4 pl-2 pr-2">
                {/* @ts-ignore */}
                {data.issues.anrs.map(({ id, title, count }) => (
                  <li key={title}>
                    {/* Show clickable link if overview journey type */}
                    {data.journeyType === JourneyType.Overview &&
                      <span className="font-sans text-xs">
                        <Link href={`/${data.teamId}/anrs/${data.appId}/${id}/${title}?start_date=${data.startDate}&end_date=${data.endDate}`} className="underline decoration-yellow-200 hover:decoration-yellow-500">
                          {title} - {formatter.format(count)}
                        </Link>
                      </span>
                    }
                    {/* Show only title and count if crash or anr journey type */}
                    {(data.journeyType === JourneyType.CrashDetails || data.journeyType === JourneyType.AnrDetails) &&
                      <span className="font-sans text-xs">
                        {title} - {formatter.format(count)}
                      </span>
                    }
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div >
    )
  }

  const getReactFlowFromJourney = (teamId: string, appId: string, journeyType: JourneyType, startDate: string, endDate: string, journey: typeof emptyJourney) => {
    // Return null flow if no nodes
    if (journey.nodes === null) {
      return { nodes: [], edges: [] }
    }

    const nodes = journey.nodes.map(node => {
      const { id, issues } = node

      let nodeTotalIssueCount = 0
      node.issues.crashes?.map((crash) => {
        nodeTotalIssueCount += crash.count
      })

      node.issues.anrs?.map((anr) => {
        nodeTotalIssueCount += anr.count
      })

      const nodeIssueContribution = nodeTotalIssueCount / journey.totalIssues

      return {
        id,
        position: { x: 0, y: 0 },
        width: 500,
        height: 200,
        type: 'measureNode',
        sourcePosition: undefined,
        targetPosition: undefined,
        data: {
          label: id,
          teamId,
          appId,
          journeyType,
          startDate,
          endDate,
          issues: issues, nodeIssueContribution
        }
      }
    })

    // Return flow with only nodes if no links
    if (journey.links === null) {
      return { nodes, edges: [] }
    }

    const edges = journey.links.map(link => {
      const { source, target, value } = link

      return {
        id: source + '-' + target,
        source,
        target,
        sourceHandle: 'b',
        label: formatter.format(value) + ' sessions',
        style: {
          stroke: edgeColorDefault,
          strokeWidth: edgeStrokeWidthDefault
        },
        animated: true
      }
    })

    return {
      nodes,
      edges
    }
  }

  const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    dagreGraph.setGraph({ rankdir: 'TB', align: 'DR', nodesep: 200, edgesep: 400 })

    nodes.forEach((node) => dagreGraph.setNode(node.id, node))
    edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target))

    Dagre.layout(dagreGraph)

    nodes.forEach((node) => {
      const nodeWithPosition = dagreGraph.node(node.id)
      node.position = {
        x: nodeWithPosition.x,
        y: nodeWithPosition.y
      }
      return node
    })

    return { nodes, edges }
  }

  const getJourney = async (teamId: string, appId: string, bidirectional: boolean, startDate: string, endDate: string, appVersions: AppVersion[]) => {
    setJourneyApiStatus(JourneyApiStatus.Loading)

    const result = await fetchJourneyFromServer(appId, journeyType, exceptionsGroupId, bidirectional, startDate, endDate, appVersions, countries, networkProviders, networkTypes, networkGenerations, locales, deviceManufacturers, deviceNames, router)

    switch (result.status) {
      case JourneyApiStatus.Error:
        setJourneyApiStatus(JourneyApiStatus.Error)
        break
      case JourneyApiStatus.Success:
        setJourneyApiStatus(JourneyApiStatus.Success)
        let flow = getReactFlowFromJourney(teamId, appId, journeyType, startDate, endDate, result.data)

        if (flow.nodes.length === 0) {
          setJourneyApiStatus(JourneyApiStatus.NoData)
          break
        }

        const layoutedFlow = getLayoutedElements(flow.nodes as Node[], flow.edges as Edge[])
        setNodes(layoutedFlow.nodes)
        setEdges(layoutedFlow.edges)
        break
    }
  }

  useEffect(() => {
    getJourney(teamId, appId, bidirectional, startDate, endDate, appVersions)
  }, [teamId, appId, bidirectional, startDate, endDate, appVersions])

  return (
    <div className="flex items-center justify-center border border-black text-black font-sans text-sm w-full h-full">
      {journeyApiStatus === JourneyApiStatus.Loading && <p className="text-lg font-display text-center p-4">Updating journey...</p>}
      {journeyApiStatus === JourneyApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching journey. Please refresh page or change filters to try again.</p>}
      {journeyApiStatus === JourneyApiStatus.NoData && <p className="text-lg font-display text-center p-4">No data</p>}
      {journeyApiStatus === JourneyApiStatus.Success
        && <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          nodesDraggable={true}
          nodesConnectable={false}
          edgesUpdatable={false}
          proOptions={{ hideAttribution: true }}
          // @ts-ignore
          nodeTypes={nodeTypes}
          minZoom={0.01}
          fitView
        >
          <Controls position='bottom-right' showInteractive={false} showFitView={false} />
          {/* <p className='w-24'>Edges: {upstreamNodes}</p>
          <p className='w-24'>Upstream: {upstreamNodes}</p> */}
        </ReactFlow>}
    </div>
  )
}

export default Journey
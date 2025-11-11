"use client"

import { ResponsiveSankey } from '@nivo/sankey'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { JourneyApiStatus, emptyJourney, fetchJourneyFromServer } from '../api/api_calls'
import { numberToKMB } from '../utils/number_utils'
import { underlineLinkStyle } from '../utils/shared_styles'
import { Button } from './button'
import { Filters } from './filters'
import LoadingSpinner from './loading_spinner'

const demoJourney: InputJourneyData = {
  links: [
    // From MainActivity (home)
    { source: "sh.measure.demo.MainActivity", target: "sh.measure.demo.ProductListActivity", value: 4200000 },
    { source: "sh.measure.demo.MainActivity", target: "sh.measure.demo.SearchActivity", value: 2800000 },
    { source: "sh.measure.demo.MainActivity", target: "sh.measure.demo.ProfileActivity", value: 1500000 },
    { source: "sh.measure.demo.MainActivity", target: "sh.measure.demo.CartActivity", value: 900000 },
    { source: "sh.measure.demo.MainActivity", target: "sh.measure.demo.ProductDetailActivity", value: 600000 },

    // From ProductListActivity
    { source: "sh.measure.demo.ProductListActivity", target: "sh.measure.demo.ProductDetailActivity", value: 3200000 },
    { source: "sh.measure.demo.ProductListActivity", target: "sh.measure.demo.CartActivity", value: 650000 },
    { source: "sh.measure.demo.ProductListActivity", target: "sh.measure.demo.SearchActivity", value: 420000 },
    { source: "sh.measure.demo.ProductListActivity", target: "sh.measure.demo.MainActivity", value: 380000 },

    // From SearchActivity
    { source: "sh.measure.demo.SearchActivity", target: "sh.measure.demo.ProductDetailActivity", value: 1600000 },
    { source: "sh.measure.demo.SearchActivity", target: "sh.measure.demo.ProductListActivity", value: 950000 },
    { source: "sh.measure.demo.SearchActivity", target: "sh.measure.demo.MainActivity", value: 340000 },
    { source: "sh.measure.demo.SearchActivity", target: "sh.measure.demo.CartActivity", value: 280000 },

    // From ProductDetailActivity
    { source: "sh.measure.demo.ProductDetailActivity", target: "sh.measure.demo.CartActivity", value: 1800000 },
    { source: "sh.measure.demo.ProductDetailActivity", target: "sh.measure.demo.ProductListActivity", value: 1200000 },
    { source: "sh.measure.demo.ProductDetailActivity", target: "sh.measure.demo.MainActivity", value: 750000 },
    { source: "sh.measure.demo.ProductDetailActivity", target: "sh.measure.demo.SearchActivity", value: 520000 },
    { source: "sh.measure.demo.ProductDetailActivity", target: "sh.measure.demo.CheckoutActivity", value: 180000 },

    // From CartActivity
    { source: "sh.measure.demo.CartActivity", target: "sh.measure.demo.CheckoutActivity", value: 1100000 },
    { source: "sh.measure.demo.CartActivity", target: "sh.measure.demo.ProductDetailActivity", value: 850000 },
    { source: "sh.measure.demo.CartActivity", target: "sh.measure.demo.ProductListActivity", value: 620000 },
    { source: "sh.measure.demo.CartActivity", target: "sh.measure.demo.MainActivity", value: 410000 },
    { source: "sh.measure.demo.CartActivity", target: "sh.measure.demo.SearchActivity", value: 190000 },

    // From CheckoutActivity
    { source: "sh.measure.demo.CheckoutActivity", target: "sh.measure.demo.PaymentActivity", value: 780000 },
    { source: "sh.measure.demo.CheckoutActivity", target: "sh.measure.demo.CartActivity", value: 320000 },
    { source: "sh.measure.demo.CheckoutActivity", target: "sh.measure.demo.ProductDetailActivity", value: 140000 },
    { source: "sh.measure.demo.CheckoutActivity", target: "sh.measure.demo.MainActivity", value: 90000 },

    // From PaymentActivity
    { source: "sh.measure.demo.PaymentActivity", target: "sh.measure.demo.OrderConfirmationActivity", value: 650000 },
    { source: "sh.measure.demo.PaymentActivity", target: "sh.measure.demo.CheckoutActivity", value: 110000 },
    { source: "sh.measure.demo.PaymentActivity", target: "sh.measure.demo.CartActivity", value: 75000 },

    // From OrderConfirmationActivity
    { source: "sh.measure.demo.OrderConfirmationActivity", target: "sh.measure.demo.MainActivity", value: 380000 },
    { source: "sh.measure.demo.OrderConfirmationActivity", target: "sh.measure.demo.ProductListActivity", value: 180000 },
    { source: "sh.measure.demo.OrderConfirmationActivity", target: "sh.measure.demo.OrderHistoryActivity", value: 120000 },

    // From ProfileActivity
    { source: "sh.measure.demo.ProfileActivity", target: "sh.measure.demo.OrderHistoryActivity", value: 680000 },
    { source: "sh.measure.demo.ProfileActivity", target: "sh.measure.demo.MainActivity", value: 520000 },
    { source: "sh.measure.demo.ProfileActivity", target: "sh.measure.demo.ProductListActivity", value: 240000 },
    { source: "sh.measure.demo.ProfileActivity", target: "sh.measure.demo.CartActivity", value: 160000 },

    // From OrderHistoryActivity
    { source: "sh.measure.demo.OrderHistoryActivity", target: "sh.measure.demo.ProductDetailActivity", value: 420000 },
    { source: "sh.measure.demo.OrderHistoryActivity", target: "sh.measure.demo.MainActivity", value: 310000 },
    { source: "sh.measure.demo.OrderHistoryActivity", target: "sh.measure.demo.ProfileActivity", value: 180000 },
    { source: "sh.measure.demo.OrderHistoryActivity", target: "sh.measure.demo.ProductListActivity", value: 150000 }
  ],
  nodes: [
    {
      id: "sh.measure.demo.MainActivity",
      issues: {
        anrs: [],
        crashes: []
      }
    },
    {
      id: "sh.measure.demo.ProductListActivity",
      issues: {
        anrs: [
          { id: "c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8", title: "kotlinx.coroutines@ProductListActivity.kt", count: 12000 }
        ],
        crashes: [
          { id: "d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9", title: "java.lang.IndexOutOfBoundsException@ProductAdapter.kt", count: 28000 },
          { id: "e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0", title: "java.lang.OutOfMemoryError@ImageLoader.kt", count: 15000 }
        ]
      }
    },
    {
      id: "sh.measure.demo.SearchActivity",
      issues: {
        anrs: [],
        crashes: []
      }
    },
    {
      id: "sh.measure.demo.ProductDetailActivity",
      issues: {
        anrs: [],
        crashes: []
      }
    },
    {
      id: "sh.measure.demo.CartActivity",
      issues: {
        anrs: [],
        crashes: []
      }
    },
    {
      id: "sh.measure.demo.CheckoutActivity",
      issues: {
        anrs: [
          { id: "k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6", title: "android.app.ActivityThread@CheckoutActivity.kt", count: 18000 }
        ],
        crashes: [
          { id: "l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7", title: "java.lang.IllegalStateException@CheckoutActivity.kt", count: 4000 },
          { id: "m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8", title: "retrofit2.HttpException@CheckoutService.kt", count: 23000 }
        ]
      }
    },
    {
      id: "sh.measure.demo.PaymentActivity",
      issues: {
        anrs: [],
        crashes: [
          { id: "o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0", title: "java.security.InvalidKeyException@PaymentProcessor.kt", count: 8000 },
          { id: "p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1", title: "javax.net.ssl.SSLHandshakeException@PaymentGateway.kt", count: 12000 }
        ]
      }
    },
    {
      id: "sh.measure.demo.OrderConfirmationActivity",
      issues: {
        anrs: [],
        crashes: []
      }
    },
    {
      id: "sh.measure.demo.ProfileActivity",
      issues: {
        anrs: [],
        crashes: []
      }
    },
    {
      id: "sh.measure.demo.OrderHistoryActivity",
      issues: {
        anrs: [],
        crashes: []
      }
    }
  ],
  totalIssues: 120000
}

interface JourneyProps {
  teamId: string,
  bidirectional: boolean,
  journeyType: JourneyType,
  exceptionsGroupId: string | null,
  filters: Filters,
  searchText?: string
  demo?: boolean
}

export enum JourneyType {
  Paths,
  Exceptions,
  CrashDetails,
  AnrDetails
}

type Link = {
  source: string
  target: string
  value: number
}

type Issue = {
  id: string
  title: string
  count: number
}

type Node = {
  id: string
  issues: {
    anrs: Issue[]
    crashes: Issue[]
  } | undefined
}

type InputJourneyData = {
  links: Link[] | undefined
  nodes: Node[] | undefined
  totalIssues: number
}

type JourneyNode = {
  id: string
  nodeColor: string
  issues: {
    anrs: Issue[] | undefined
    crashes: Issue[] | undefined
  } | undefined
}

type JourneyLink = {
  source: string
  target: string
  value: number
  startColor?: string,
  endColor?: string
}

type JourneyData = {
  nodes: JourneyNode[]
  links: JourneyLink[]
}

const positiveNodeColour = 'oklch(63.7% 0.237 25.331)'
const negativeNodeColour = 'oklch(72.3% 0.219 149.579)'
const neutralLinkColour = `oklch(87.2% 0.01 258.338)`
const exceptionNodeLabelColour = 'oklch(0.141 0.005 285.823)'
const exceptionNodeLabelColourDark = 'oklch(0.985 0 0)'

function getNodeColor(node: Node): string {
  const hasIssues = node.issues?.anrs?.length! > 0 || node.issues?.crashes?.length! > 0

  if (hasIssues) {
    return positiveNodeColour
  } else {
    return negativeNodeColour
  }
}

// Helper function to detect cycles using DFS
function hasCycle(node: string, graph: Map<string, string[]>, visited: Set<string>, recStack: Set<string>): boolean {
  if (!visited.has(node)) {
    // Mark the current node as visited and add to recursion stack
    visited.add(node)
    recStack.add(node)

    // Recur for all neighbors
    const neighbors = graph.get(node) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor) && hasCycle(neighbor, graph, visited, recStack)) {
        return true
      } else if (recStack.has(neighbor)) {
        return true
      }
    }
  }
  recStack.delete(node)
  return false
}

const NODE_LIMIT = 100 // Use constant for the node limit

function transformData(journeyType: JourneyType, input: InputJourneyData): JourneyData {
  const nodes = input.nodes || []
  const links = input.links || []

  const graph = new Map<string, string[]>()
  const linkedNodes = new Set<string>() // Set to keep track of nodes with links
  const outputLinks: JourneyLink[] = []

  if (links.length > 0) {
    links.forEach(link => {
      const { source, target, value } = link

      if (!graph.has(source)) graph.set(source, [])
      graph.get(source)!.push(target)

      // Track nodes that have links
      linkedNodes.add(source)
      linkedNodes.add(target)

      // Check for cycles before adding the link
      const visited = new Set<string>()
      const recStack = new Set<string>()

      if (!hasCycle(source, graph, visited, recStack)) {
        outputLinks.push({
          source,
          target,
          value,
          // Leave startColor and endColor undefined for path journeys so they use default colors
          startColor: journeyType === JourneyType.Paths ? undefined : neutralLinkColour,
          endColor: journeyType === JourneyType.Paths ? undefined : neutralLinkColour,
        })
      } else {
        // Remove the edge that would cause a cycle from the graph
        graph.get(source)!.pop()
      }
    })
  }

  // Rank nodes: prioritize nodes with issues first, then by number of connections
  const rankedNodes = nodes
    .map(node => ({
      ...node,
      connections: (graph.get(node.id)?.length || 0), // Number of connections for each node
      hasIssues: node.issues?.anrs?.length! > 0 || node.issues?.crashes?.length! > 0, // Check if node has issues
    }))
    .sort((a, b) => {
      // Sort by issues first, then by number of connections
      if (a.hasIssues && !b.hasIssues) return -1
      if (!a.hasIssues && b.hasIssues) return 1
      return b.connections - a.connections // Descending order of connections
    })
    .slice(0, NODE_LIMIT) // Limit nodes to NODE_LIMIT

  // Extract the IDs of the ranked nodes
  const rankedNodeIds = new Set(rankedNodes.map(node => node.id))

  // Filter out links whose source or target nodes are not in the allowedNodeIds
  const finalLinks = outputLinks.filter(link => rankedNodeIds.has(link.source) && rankedNodeIds.has(link.target))

  // Compute finalLinkedNodeIds based on the final links
  const finalLinkedNodeIds = new Set<string>()
  finalLinks.forEach(link => {
    finalLinkedNodeIds.add(link.source)
    finalLinkedNodeIds.add(link.target)
  })

  // Only include nodes that are part of the final linked nodes
  const outputNodes: JourneyNode[] = rankedNodes
    .filter(node => finalLinkedNodeIds.has(node.id))
    .map(node => ({
      id: node.id,
      nodeColor: getNodeColor(node),
      issues: node.issues,
    }))

  return {
    nodes: outputNodes,
    links: finalLinks,
  }
}

const Journey: React.FC<JourneyProps> = ({ teamId, bidirectional, journeyType, exceptionsGroupId, filters, searchText = '', demo = false }) => {
  const { theme } = useTheme()
  const [journeyApiStatus, setJourneyApiStatus] = useState(JourneyApiStatus.Loading)
  const [journey, setJourney] = useState<JourneyData>(transformData(journeyType, emptyJourney))

  const [selectedNode, setSelectedNode] = useState<JourneyNode>()
  const [showPanel, setShowPanel] = useState(false)

  const getJourney = async () => {
    if (demo) {
      const journey = transformData(journeyType, demoJourney)
      setJourney(journey)
      setJourneyApiStatus(JourneyApiStatus.Success)
      return
    }

    setJourneyApiStatus(JourneyApiStatus.Loading)

    const result = await fetchJourneyFromServer(journeyType, exceptionsGroupId, bidirectional, filters)

    switch (result.status) {
      case JourneyApiStatus.Error:
        setJourneyApiStatus(JourneyApiStatus.Error)
        break
      case JourneyApiStatus.Success:
        setJourneyApiStatus(JourneyApiStatus.Success)

        let journey = transformData(journeyType, result.data)

        if (journey.nodes.length === 0) {
          setJourneyApiStatus(JourneyApiStatus.NoData)
          break
        }

        setJourney(journey)
        break
    }
  }

  useEffect(() => {
    getJourney()
  }, [teamId, bidirectional, journeyType, exceptionsGroupId, filters])

  useEffect(() => {
    if (journeyType === JourneyType.Exceptions && selectedNode !== undefined && (selectedNode.issues?.crashes?.length! > 0 || selectedNode.issues?.anrs?.length! > 0)) {
      setShowPanel(true)
    } else {
      setShowPanel(false)
    }
  }, [selectedNode])

  const getSearchFilteredJourney = () => {
    if (!searchText.trim()) return journey
    const lowerSearch = searchText.toLowerCase()

    // Find nodes that match the search text
    const matchingNodeIds = new Set(
      journey.nodes.filter(node => node.id.toLowerCase().includes(lowerSearch)).map(node => node.id)
    )

    // if no nodes match, return original journey
    if (matchingNodeIds.size === 0) {
      return journey
    }

    // Find all nodes connected to matching nodes (directly via links)
    const connectedNodeIds = new Set([...matchingNodeIds])
    journey.links.forEach(link => {
      if (matchingNodeIds.has(link.source) || matchingNodeIds.has(link.target)) {
        connectedNodeIds.add(link.source)
        connectedNodeIds.add(link.target)
      }
    })

    // Filter nodes and links
    const filteredNodes = journey.nodes.filter(node => connectedNodeIds.has(node.id))
    const filteredLinks = journey.links.filter(link => connectedNodeIds.has(link.source) && connectedNodeIds.has(link.target))
    return { nodes: filteredNodes, links: filteredLinks }
  }

  return (
    <div className="flex flex-col items-center justify-center font-body text-sm w-full h-full overflow-hidden">
      <div className="flex-1 flex items-center justify-center w-full h-full">
        {journeyApiStatus === JourneyApiStatus.Loading && <LoadingSpinner />}
        {journeyApiStatus === JourneyApiStatus.Error && <p className="text-lg font-display text-center p-4">Error fetching journey. Please refresh page or change filters to try again.</p>}
        {journeyApiStatus === JourneyApiStatus.NoData && <p className="text-lg font-display text-center p-4">No journey data</p>}
        {journeyApiStatus === JourneyApiStatus.Success &&
          <div className='relative w-full h-full'>
            <ResponsiveSankey
              data={getSearchFilteredJourney()}
              align="justify"
              sort="input"
              margin={{ top: 10, right: 10, bottom: 40, left: 10 }}
              linkContract={30}
              colors={journeyType === JourneyType.Exceptions ? node => node.nodeColor : theme === 'dark' ? { scheme: 'tableau10' } : { scheme: 'nivo' }}
              nodeBorderColor={
                {
                  from: 'color',
                  modifiers: [theme === "dark" ? ['brighter', 0.5] : ['darker', 0.3]]
                }
              }
              nodeBorderRadius={3}
              enableLinkGradient={true}
              label={node => `${node.id.split(".").pop()?.substring(0, 4)}...`}
              labelPosition="inside"
              labelOrientation="horizontal"
              labelPadding={8}
              labelTextColor={
                journeyType === JourneyType.Exceptions
                  ? (theme === 'dark' ? exceptionNodeLabelColourDark : exceptionNodeLabelColour)
                  : {
                    from: 'color',
                    modifiers: [theme === 'dark' ? ['brighter', 0.5] : ['darker', 0.7]]
                  }
              }
              linkBlendMode={theme === 'dark' ? 'lighten' : 'multiply'}
              onClick={(nodeOrLink) => setSelectedNode(nodeOrLink as JourneyNode)}
              linkTooltip={({
                link
              }) =>
                <div className={`flex flex-col p-2 text-xs font-body rounded-md bg-accent text-accent-foreground break-words`}>
                  <p className='p-2'>{link.source.id.split(".").pop()} → {link.target.id.split(".").pop()}: {link.value > 1 ? link.value + ' sessions' : link.value + ' session'}</p>
                </div>}
              nodeTooltip={({
                node
              }) =>
                <div className={`flex flex-col p-2 text-xs font-body rounded-md bg-accent text-accent-foreground break-words`}>
                  <p className='p-2'>{node.id}</p>

                  {journeyType === JourneyType.Exceptions && node.issues?.crashes?.length! > 0 &&
                    <p className='px-2 py-1 text-red-400'>Crashes: {node.issues?.crashes?.reduce((sum, issue) => sum + issue.count, 0)}</p>
                  }

                  {journeyType === JourneyType.Exceptions && node.issues?.anrs?.length! > 0 &&
                    <p className='px-2 py-1 text-yellow-400'>ANRs: {node.issues?.anrs?.reduce((sum, issue) => sum + issue.count, 0)}</p>
                  }

                  {journeyType === JourneyType.Exceptions && (node.issues?.crashes?.length! > 0 || node.issues?.anrs?.length! > 0) &&
                    <p className='px-2 pt-4 pb-2'>Click for details</p>
                  }

                </div>
              }
            />
            {/* Panel */}
            <div
              className={`absolute overflow-auto top-0 right-0 h-full w-3/4 bg-accent p-4 text-accent-foreground break-words transform transition-transform duration-300 ease-in-out ${showPanel ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
              {selectedNode !== undefined &&
                <div>
                  <Button variant="secondary" className="py-2 px-4"
                    onClick={() => setSelectedNode(undefined)}>Close
                  </Button>
                  <p className='mt-6 text-lg'>{selectedNode!.id}</p>
                  {selectedNode.issues?.crashes?.length! > 0 && (
                    <div>
                      <p className="font-body mt-4">Crashes:</p>
                      <ul className="list-disc list-inside pt-2 pb-4 pl-2 pr-2">
                        {selectedNode.issues?.crashes?.map(({ id, title, count }) => (
                          <li key={title}>
                            {/* Show clickable link if Exceptions journey type */}
                            {journeyType === JourneyType.Exceptions &&
                              <span className="font-body text-xs">
                                {demo ? (
                                  <div className={underlineLinkStyle}>{title} - {numberToKMB(count)}</div>
                                ) : (
                                  <Link href={`/${teamId}/crashes/${filters.app!.id}/${id}/${title}?start_date=${filters.startDate}&end_date=${filters.endDate}`} className={underlineLinkStyle}>
                                    {title} - {numberToKMB(count)}
                                  </Link>
                                )}
                              </span>
                            }
                            {/* Show only title and count if crash or anr journey type */}
                            {(journeyType === JourneyType.CrashDetails || journeyType === JourneyType.AnrDetails) &&
                              <span className="font-body text-xs">
                                {title} - {numberToKMB(count)}
                              </span>
                            }
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedNode.issues?.anrs?.length! > 0 && (
                    <div>
                      <p className="font-body pt-2">ANRs:</p>
                      <ul className="list-disc list-inside pt-2 pb-4 pl-2 pr-2">
                        {selectedNode.issues?.anrs?.map(({ id, title, count }) => (
                          <li key={title}>
                            {/* Show clickable link if Exceptions journey type */}
                            {journeyType === JourneyType.Exceptions &&
                              <span className="font-body text-xs">
                                {demo ? (
                                  <div className={underlineLinkStyle}>{title} - {numberToKMB(count)}</div>
                                ) : (
                                  <Link href={`/${teamId}/anrs/${filters.app!.id}/${id}/${title}?start_date=${filters.startDate}&end_date=${filters.endDate}`} className={underlineLinkStyle}>
                                    {title} - {numberToKMB(count)}
                                  </Link>
                                )}
                              </span>
                            }
                            {/* Show only title and count if crash or anr journey type */}
                            {(journeyType === JourneyType.CrashDetails || journeyType === JourneyType.AnrDetails) &&
                              <span className="font-body text-xs">
                                {title} - {numberToKMB(count)}
                              </span>
                            }
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              }
            </div>
          </div>}
      </div>
    </div >
  )
}

export default Journey
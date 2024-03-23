"use client"

import React, { useState, useEffect, FunctionComponent } from 'react';
import { NodeTooltipProps } from '@nivo/network';
import { useRouter } from 'next/navigation';
import { AppVersion, JourneyApiStatus, emptyJourney, fetchJourneyFromServer } from '../api/api_calls';
import { ResponsiveNetwork } from '@nivo/network';

interface JourneyProps {
  appId: string,
  startDate: string,
  endDate: string,
  appVersion: AppVersion,
}

type Node = {
  id: string;
  nodeColor: string;
  height: number;
  size: number;
  issues: {
    crashes: { title: string; count: number }[];
    anrs: { title: string; count: number }[];
  };
};

const NodeTooltip: React.FC<NodeTooltipProps<Node>> = ({ node }) => {
  const formatter = Intl.NumberFormat('en', { notation: 'compact' });

  return (
    <div className="pointer-events-none z-50 rounded-md p-4 bg-neutral-800">
      <p className="font-sans text-white">{node.id}</p>
      {node.data.issues.crashes.length > 0 && (
        <div>
          <div className="py-2" />
          <p className="font-sans text-white">Crashes:</p>
          <ul className="list-disc">
            {node.data.issues.crashes.map(({ title, count }) => (
              <li key={title}>
                <span className="font-sans text-white text-xs">
                  {title} - {formatter.format(count)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {node.data.issues.anrs.length > 0 && (
        <div>
          <div className="py-2" />
          <p className="font-sans text-white">ANRs:</p>
          <ul className="list-disc">
            {node.data.issues.anrs.map(({ title, count }) => (
              <li key={title}>
                <span className="font-sans text-white text-xs">
                  {title} - {formatter.format(count)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const Journey: React.FC<JourneyProps> = ({ appId, startDate, endDate, appVersion }) => {

  const [journeyApiStatus, setJourneyApiStatus] = useState(JourneyApiStatus.Loading);
  const [journey, setJourney] = useState(emptyJourney);

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
        break
    }
  }

  useEffect(() => {
    getJourney(appId, startDate, endDate, appVersion)
  }, [appId, startDate, endDate, appVersion]);

  function mapJourneyToNetwork(journey: typeof emptyJourney) {
    const nodes = journey.nodes.map(node => {
      const { id, nodeColor, issues } = node;
      const height = 0;
      const size = 4 * Math.floor(Math.random() * 11) + 8; // Assign a random size between 8 and 48 as a multiple of 4

      return {
        id,
        nodeColor,
        height,
        size,
        issues
      };
    });

    const maxLinkValue = Math.max(...journey.links.map(link => link.value));
    const minLinkValue = Math.min(...journey.links.map(link => link.value));

    const links = journey.links.map(link => {
      const { source, target, value } = link;
      const distance = 50 + ((value - minLinkValue) * 500) / (maxLinkValue - minLinkValue);

      return {
        source,
        target,
        distance: Math.round(distance)
      };
    });

    return {
      nodes,
      links
    };
  }

  return (
    <div className="flex items-center justify-center border border-black text-black font-sans text-sm w-5/6 h-screen">
      {journeyApiStatus === JourneyApiStatus.Loading && <p className="text-lg">Updating journey...</p>}
      {journeyApiStatus === JourneyApiStatus.Error && <p className="text-lg">Error fetching journey. Please refresh page or change filters to try again.</p>}
      {journeyApiStatus === JourneyApiStatus.Success
        && <ResponsiveNetwork
          data={mapJourneyToNetwork(journey)}
          margin={{ top: 80, right: 120, bottom: 80, left: 120 }}
          nodeBorderWidth={1}
          nodeBorderColor={{
            from: 'color',
            modifiers: [
              [
                'darker',
                0.8
              ]
            ]
          }}
          linkDistance={e => e.distance}
          centeringStrength={0}
          repulsivity={10}
          linkColor={"rgb(161 161 170)"}
          nodeSize={n => n.size}
          activeNodeSize={n => 1.5 * n.size}
          nodeColor={node => node.nodeColor}
          linkThickness={n => n.data.distance / 100}
          linkBlendMode="multiply"
          motionConfig="wobbly"
          // @ts-ignore
          nodeTooltip={NodeTooltip}
        />}
    </div>
  );
};

export default Journey;
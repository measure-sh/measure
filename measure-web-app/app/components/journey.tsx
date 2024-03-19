"use client"

import React, { useState, useEffect } from 'react';
import { ResponsiveSankey } from '@nivo/sankey'
import { useRouter } from 'next/navigation';
import { AppVersion, JourneyApiStatus, emptyJourney, fetchJourneyFromServer } from '../api/api_calls';

interface JourneyProps {
  appId: string,
  startDate: string,
  endDate: string,
  appVersion: AppVersion,
}

const Journey: React.FC<JourneyProps> = ({ appId, startDate, endDate, appVersion }) => {

  const formatter = Intl.NumberFormat('en', { notation: 'compact' });

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

  return (
    <div className="flex items-center justify-center border border-black text-black font-sans text-sm w-5/6 h-screen">
      {journeyApiStatus === JourneyApiStatus.Loading && <p className="text-lg">Updating journey...</p>}
      {journeyApiStatus === JourneyApiStatus.Error && <p className="text-lg">Error fetching journey. Please refresh page or change filters to try again.</p>}
      {journeyApiStatus === JourneyApiStatus.Success
        && <ResponsiveSankey
          data={journey}
          margin={{ top: 80, right: 120, bottom: 80, left: 120 }}
          align="justify"
          colors={({ nodeColor }) => nodeColor}
          nodeOpacity={1}
          nodeHoverOthersOpacity={0.35}
          nodeThickness={18}
          nodeSpacing={24}
          nodeBorderWidth={0}
          nodeBorderColor={{
            from: 'color',
            modifiers: [
              [
                'darker',
                0.8
              ]
            ]
          }}
          nodeBorderRadius={3}
          linkOpacity={0.25}
          linkHoverOthersOpacity={0.1}
          linkContract={3}
          enableLinkGradient={false}
          labelPosition="outside"
          labelOrientation="horizontal"
          labelPadding={16}
          labelTextColor="#000000"
          nodeTooltip={({
            node
          }) => <div className="pointer-events-none z-50 rounded-md p-4 bg-neutral-800">
              <p className="font-sans text-white">{node.label}</p>
              {node.issues.crashes.length > 0 &&
                <div>
                  <div className="py-2" />
                  <p className="font-sans text-white">Crashes:</p>
                  <ul className="list-disc">
                    {node.issues.crashes.map(({ title, count }) => (
                      <li key={title}>
                        <span className="font-sans text-white text-xs">{title} - {formatter.format(count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              }
              {node.issues.anrs.length > 0 &&
                <div>
                  <div className="py-2" />
                  <p className="font-sans text-white">ANRs:</p>
                  <ul className="list-disc">
                    {node.issues.anrs.map(({ title, count }) => (
                      <li key={title}>
                        <span className="font-sans text-white text-xs">{title} - {formatter.format(count)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              }
            </div>}
          linkTooltip={({
            link
          }) => <div className="pointer-events-none z-50 rounded-md p-4 bg-neutral-800">
              <p className="font-sans text-white">{link.source.label} &gt; {link.target.label} - {formatter.format(link.value)} </p>
            </div>}
        />}
    </div>
  );
};

export default Journey;
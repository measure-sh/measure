"use client"

import React, { useState, useEffect } from 'react';
import { ResponsiveSankey } from '@nivo/sankey'
import { getAccessTokenOrRedirectToAuth, logoutIfAuthError } from '@/app/utils/auth_utils';
import { useRouter } from 'next/navigation';

interface JourneyProps {
  appId: string,
  startDate: string,
  endDate: string,
  appVersion: string,
}

const Journey: React.FC<JourneyProps> = ({ appId, startDate, endDate, appVersion }) => {
  enum JourneyApiStatus {
    Loading,
    Success,
    Error
  }

  const emptyData = {
    "nodes": [
      {
        "id": "",
        "nodeColor": "",
        "issues": {
          "crashes": [],
          "anrs": []
        }
      },
    ],
    "links": [
    ]
  }

  const formatter = Intl.NumberFormat('en', { notation: 'compact' });

  const [journeyApiStatus, setJourneyApiStatus] = useState(JourneyApiStatus.Loading);
  const [data, setData] = useState(emptyData);

  const router = useRouter()

  const getData = async (appId: string, startDate: string, endDate: string, appVersion: string) => {
    setJourneyApiStatus(JourneyApiStatus.Loading)

    const authToken = await getAccessTokenOrRedirectToAuth(router)
    const origin = process.env.NEXT_PUBLIC_API_BASE_URL
    const opts = {
      headers: {
        "Authorization": `Bearer ${authToken}`
      }
    };

    const serverFormattedStartDate = new Date(startDate).toISOString()
    const serverFormattedEndDate = new Date(endDate).toISOString()
    const res = await fetch(`${origin}/apps/${appId}/journey?version=${appVersion}&from=${serverFormattedStartDate}&to=${serverFormattedEndDate}`, opts);

    if (!res.ok) {
      setJourneyApiStatus(JourneyApiStatus.Error)
      logoutIfAuthError(router, res)
      return
    }

    setJourneyApiStatus(JourneyApiStatus.Success)
    setData(await res.json())
  }

  useEffect(() => {
    getData(appId, startDate, endDate, appVersion)
  }, [appId, startDate, endDate, appVersion]);

  return (
    <div className="flex items-center justify-center border border-black text-black font-sans text-sm w-5/6 h-screen">
      {journeyApiStatus === JourneyApiStatus.Loading && <p className="text-lg">Updating data...</p>}
      {journeyApiStatus === JourneyApiStatus.Error && <p className="text-lg">Error fetching data. Please refresh page or change filters to try again.</p>}
      {journeyApiStatus === JourneyApiStatus.Success
        && <ResponsiveSankey
          data={data}
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
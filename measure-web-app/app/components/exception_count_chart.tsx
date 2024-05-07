"use client"

import React from 'react';
import { ResponsiveLine } from '@nivo/line'
import { DateTime } from 'luxon';

const dateFormat = 'yyyy-MM-dd'
const today = DateTime.now();

const sevenDaysAgo = today.minus({ days: 7 });
const date1 = sevenDaysAgo.toFormat(dateFormat);

const sixDaysAgo = today.minus({ days: 6 });
const date2 = sixDaysAgo.toFormat(dateFormat);

const fiveDaysAgo = today.minus({ days: 5 });
const date3 = fiveDaysAgo.toFormat(dateFormat);

const fourDaysAgo = today.minus({ days: 4 });
const date4 = fourDaysAgo.toFormat(dateFormat);

const threeDaysAgo = today.minus({ days: 3 });
const date5 = threeDaysAgo.toFormat(dateFormat);

const twoDaysAgo = today.minus({ days: 2 });
const date6 = twoDaysAgo.toFormat(dateFormat);

const oneDayAgo = today.minus({ days: 1 });
const date7 = oneDayAgo.toFormat(dateFormat);

const date8 = today.toFormat(dateFormat);

const data = [
  {
    "id": "Version 13.2.1",
    "color": "hsl(351, 70%, 50%)",
    "data": [
      {
        "x": date1,
        "y": 17890
      },
      {
        "x": date2,
        "y": 17670
      },
      {
        "x": date3,
        "y": 16890
      },
      {
        "x": date4,
        "y": 17891
      },
      {
        "x": date5,
        "y": 15431
      },
      {
        "x": date6,
        "y": 16578
      },
      {
        "x": date7,
        "y": 18903
      },
      {
        "x": date8,
        "y": 17442
      }
    ]
  },
  {
    "id": "Version 13.2.2",
    "color": "hsl(189, 70%, 50%)",
    "data": [
      {
        "x": date1,
        "y": 17890
      },
      {
        "x": date2,
        "y": 18657
      },
      {
        "x": date3,
        "y": 18456
      },
      {
        "x": date4,
        "y": 18236
      },
      {
        "x": date5,
        "y": 17906
      },
      {
        "x": date6,
        "y": 18119
      },
      {
        "x": date7,
        "y": 17993
      },
      {
        "x": date8,
        "y": 18265
      }
    ]
  },
  {
    "id": "Version 13.3.7",
    "color": "hsl(136, 70%, 50%)",
    "data": [
      {
        "x": date1,
        "y": 14221
      },
      {
        "x": date2,
        "y": 14789
      },
      {
        "x": date3,
        "y": 15211
      },
      {
        "x": date4,
        "y": 16783
      },
      {
        "x": date5,
        "y": 15223
      },
      {
        "x": date6,
        "y": 14992
      },
      {
        "x": date7,
        "y": 14203
      },
      {
        "x": date8,
        "y": 14653
      }
    ]
  }
]

const ExceptionCountChart = () => {
  return (
    <ResponsiveLine
      data={data}
      margin={{ top: 40, right: 160, bottom: 80, left: 120 }}
      xFormat="time:%Y-%m-%d"
      xScale={{
        format: '%Y-%m-%d',
        precision: 'day',
        type: 'time',
        useUTC: false
      }}
      yScale={{
        type: 'linear',
        min: 'auto',
        max: 'auto'
      }}
      yFormat=" >-.2f"
      axisTop={null}
      axisRight={null}
      axisBottom={{
        legend: 'Date',
        legendOffset: 60,
        format: '%b %d',
        tickValues: 'every 1 days',
        legendPosition: 'middle'
      }}
      axisLeft={{
        tickSize: 1,
        tickPadding: 5,
        legend: 'Crash instances',
        legendOffset: -80,
        legendPosition: 'middle'
      }}
      pointSize={10}
      pointColor={{ theme: 'background' }}
      pointBorderWidth={2}
      pointBorderColor={{ from: 'serieColor' }}
      pointLabelYOffset={-12}
      useMesh={true}
      legends={[
        {
          anchor: 'bottom-right',
          direction: 'column',
          justify: false,
          translateX: 100,
          translateY: 0,
          itemsSpacing: 0,
          itemDirection: 'left-to-right',
          itemWidth: 80,
          itemHeight: 20,
          itemOpacity: 0.75,
          symbolSize: 12,
          symbolShape: 'circle',
          symbolBorderColor: 'rgba(0, 0, 0, .5)',
        }
      ]}
    />
  )
};

export default ExceptionCountChart;
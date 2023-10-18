"use client"

import React from 'react';
import { ResponsiveSankey } from '@nivo/sankey'


const data = {
  "nodes": [
    {
      "id": "Home Screen",
      "nodeColor": "hsl(142, 69%, 58%)",
      "issues": {
        "crashes": [],
        "anrs":[]
      }
    },
    {
      "id": "Order History",
      "nodeColor": "hsl(142, 69%, 58%)",
      "issues": {
        "crashes": [],
        "anrs":[]
      }
    },
    {
      "id": "Order Status",
      "nodeColor": "hsl(142, 69%, 58%)",
      "issues": {
        "crashes": [],
        "anrs":[]
      }
    },
    {
      "id": "Support",
      "nodeColor": "hsl(142, 69%, 58%)",
      "issues": {
        "crashes": [],
        "anrs":[]
      }
    },
    {
      "id": "List Of Items",
      "nodeColor": "hsl(142, 69%, 58%)",
      "issues": {
        "crashes": [],
        "anrs":[]
      }
    },
    {
      "id": "Sales Offer",
      "nodeColor": "hsl(142, 69%, 58%)",
      "issues": {
        "crashes": [],
        "anrs":[]
      }
    },
    {
      "id": "View Item Images",
      "nodeColor": "hsl(142, 69%, 58%)",
      "issues": {
        "crashes": [],
        "anrs":[]
      }
    },
    {
      "id": "View Item Detail",
      "nodeColor": "hsl(142, 69%, 58%)",
      "issues": {
        "crashes": [],
        "anrs":[]
      }
    },
    {
      "id": "Cyber Monday Sale Items List",
      "nodeColor": "hsl(0, 72%, 51%)",
      "issues": {
        "crashes": [{
          "title": "NullPointerException.java",
          "count": 37893
        }, 
        {
          "title": "LayoutInflaterException.java",
          "count": 12674
        }],
        "anrs":[{
          "title": "CyberMondayActivity.java",
          "count": 97321
        }, 
        {
          "title": "CyberMondayFragment.kt",
          "count": 8005
        }]
      }
    },
    {
      "id": "Add To Cart",
      "nodeColor": "hsl(142, 69%, 58%)",
      "issues": {
        "crashes": [],
        "anrs":[]
      }
    },
    {
      "id": "Pay",
      "nodeColor": "hsl(142, 69%, 58%)",
      "issues": {
        "crashes": [],
        "anrs":[]
      }
    },
    {
      "id": "Explore Discounts",
      "nodeColor": "hsl(142, 69%, 58%)",
      "issues": {
        "crashes": [],
        "anrs":[]
      }
    }
  ],
  "links": [
    {
      "source": "Home Screen",
      "target": "Order History",
      "value": 50000
    },
    {
      "source": "Home Screen",
      "target": "List Of Items",
      "value": 73356
    },
    {
      "source": "Home Screen",
      "target": "Cyber Monday Sale Items List",
      "value": 97652
    },
    {
      "source": "Order History",
      "target": "Order Status",
      "value": 9782
    },
    {
      "source": "Order History",
      "target": "Support",
      "value": 2837
    },
    {
      "source": "List Of Items",
      "target": "Sales Offer",
      "value": 14678
    },
    {
      "source": "List Of Items",
      "target": "View Item Detail",
      "value": 23654
    },
    {
      "source": "Cyber Monday Sale Items List",
      "target": "View Item Detail",
      "value": 43889
    },
    {
      "source": "Cyber Monday Sale Items List",
      "target": "Explore Discounts",
      "value": 34681
    },
    {
      "source": "Sales Offer",
      "target": "View Item Images",
      "value": 12055
    },
    {
      "source": "View Item Detail",
      "target": "View Item Images",
      "value": 16793
    },
    {
      "source": "View Item Detail",
      "target": "Add To Cart",
      "value": 11537
    },
    {
      "source": "Add To Cart",
      "target": "Pay",
      "value": 10144
    },
    {
      "source": "Add To Cart",
      "target": "Explore Discounts",
      "value": 4007
    }
  ]
}

const formatter = Intl.NumberFormat('en', { notation: 'compact' });

const UserFlow = () => {
    return (
      <ResponsiveSankey
      data={data}
      margin={{ top: 80, right: 120, bottom: 80, left: 120 }}
      align="justify"
      colors={({nodeColor}) => nodeColor}
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
                  <div className="py-2"/>
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
               {node.issues.crashes.length > 0 && 
                <div>
                  <div className="py-2"/>
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
  />
  );
};

export default UserFlow;
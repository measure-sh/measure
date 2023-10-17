"use client"

import React from 'react';
import { ResponsiveSankey } from '@nivo/sankey'


const data = {
  "nodes": [
    {
      "id": "Home Screen",
      "nodeColor": "hsl(142, 69%, 58%)"
    },
    {
      "id": "Order History",
      "nodeColor": "hsl(142, 69%, 58%)"
    },
    {
      "id": "Order Status",
      "nodeColor": "hsl(142, 69%, 58%)"
    },
    {
      "id": "Support",
      "nodeColor": "hsl(142, 69%, 58%)"
    },
    {
      "id": "List Of Items",
      "nodeColor": "hsl(142, 69%, 58%)"
    },
    {
      "id": "Sales Offer",
      "nodeColor": "hsl(142, 69%, 58%)"
    },
    {
      "id": "View Item Images",
      "nodeColor": "hsl(142, 69%, 58%)"
    },
    {
      "id": "View Item Detail",
      "nodeColor": "hsl(142, 69%, 58%)"
    },
    {
      "id": "Cyber Monday Sale Items List",
      "nodeColor": "hsl(0, 72%, 51%)"
    },
    {
      "id": "Add To Cart",
      "nodeColor": "hsl(142, 69%, 58%)"
    },
    {
      "id": "Pay",
      "nodeColor": "hsl(142, 69%, 58%)"
    },
    {
      "id": "Explore Discounts",
      "nodeColor": "hsl(142, 69%, 58%)"
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


const UserFlow = () => {
    return (
      <ResponsiveSankey
      data={data}
      margin={{ top: 40, right: 160, bottom: 40, left: 50 }}
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
  />
  );
};

export default UserFlow;
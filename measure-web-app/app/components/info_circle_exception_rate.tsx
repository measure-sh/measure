import React from 'react';
import { MetricsApiStatus } from './metrics_overview';

interface InfoCircleExceptionRateExceptionRateProps {
  status: MetricsApiStatus,
  value: number;
  delta: number;
  title: string;
  tooltipMsgLine1: string;
  tooltipMsgLine2: string;
}

const InfoCircleExceptionRate = ({ status, value, delta, title, tooltipMsgLine1, tooltipMsgLine2 }: InfoCircleExceptionRateExceptionRateProps) => {
    return (
      <div className="flex flex-col items-center">
          <div className={`flex flex-col group relative items-center justify-center w-64 aspect-square rounded-full border border-4 transition-colors duration-100 ${status!==MetricsApiStatus.Success? 'border-black hover:bg-neutral-800/25': value > 95? 'border-green-400 hover:bg-green-400/25': value > 85? 'border-yellow-400 hover:bg-yellow-400/25': 'border-red-400 hover:bg-red-400/25'}`}>
              {status === MetricsApiStatus.Loading && <p className="font-display text-lg">Updating...</p>}
              {status === MetricsApiStatus.Error && <p className="font-display text-lg">Error</p>}
              {status === MetricsApiStatus.Success && <p className="font-sans text-xl"> {value}%</p>}
              <div className="py-1"/>
              {status === MetricsApiStatus.Success && <p className={`font-sans text-sm ${delta > 0? 'text-green-600': delta < 0? 'text-red-400': 'opacity-0'}`}>{delta>0? '+':''}{delta}%</p>}
              <span className="pointer-events-none z-50 max-w-xl absolute font-sans text-sm text-white rounded-md p-4 bg-neutral-800 -top-48 left-0 w-max opacity-0 transition-opacity group-hover:opacity-100">{tooltipMsgLine1}<br/><br/>{tooltipMsgLine2}</span>
          </div>
          <div className="py-2"/>
          <p className="text-black font-display text-lg">{title}</p>
      </div>
  );
};

export default InfoCircleExceptionRate;
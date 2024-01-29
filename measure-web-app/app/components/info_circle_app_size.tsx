import React from 'react';
import { MetricsApiStatus } from '../api/api_calls';

interface InfoCircleAppSizeProps {
  status: MetricsApiStatus,
  value: number;
  delta: number;
  title: string;
}

const InfoCircleAppSize = ({ status, value, delta, title }: InfoCircleAppSizeProps) => {
  return (
    <div className="flex flex-col items-center">
      <div className={`flex flex-col group relative items-center justify-center w-64 aspect-square rounded-full border border-black border-4 hover:bg-neutral-800/25 transition-colors duration-100`}>
        {status === MetricsApiStatus.Loading && <p className="font-display text-lg">Updating...</p>}
        {status === MetricsApiStatus.Error && <p className="font-display text-lg">Error</p>}
        {status === MetricsApiStatus.Success && <p className="font-sans text-xl"> {value}MB</p>}
        <div className="py-1" />
        {status === MetricsApiStatus.Success && <p className={`font-sans text-sm ${delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-400' : 'opacity-0'}`}>{delta > 0 ? '+' : ''}{delta}MB</p>}
        <span className="pointer-events-none z-50 max-w-xl absolute font-sans text-sm text-white rounded-md p-4 bg-neutral-800 -top-32 left-0 w-max opacity-0 transition-opacity group-hover:opacity-100">
          Delta value = App size of selected app version - Average app size of all app versions
        </span>
      </div>
      <div className="py-2" />
      <p className="font-display text-lg">{title}</p>
    </div>
  );
};

export default InfoCircleAppSize;
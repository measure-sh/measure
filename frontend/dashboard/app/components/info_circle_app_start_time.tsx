import React from 'react';
import { MetricsApiStatus } from '../api/api_calls';
import LoadingSpinner from './loading_spinner';

interface InfoCircleAppStartTimeProps {
  status: MetricsApiStatus,
  noData: boolean,
  value: number;
  delta: number;
  title: string;
  launchType: string;
}

const InfoCircleAppStartTime = ({ status, noData, value, delta, title, launchType }: InfoCircleAppStartTimeProps) => {
  return (
    <div className="flex flex-col items-center">
      <div className={`flex flex-col group relative items-center justify-center w-64 aspect-square rounded-full border border-4 transition-colors duration-100 ${(status !== MetricsApiStatus.Success || noData === true) ? 'border-black hover:bg-neutral-800/25' : value < 800 ? 'border-green-400 hover:bg-green-400/25' : value < 1200 ? 'border-yellow-400 hover:bg-yellow-400/25' : 'border-red-400 hover:bg-red-400/25'}`}>
        {status === MetricsApiStatus.Loading && <LoadingSpinner />}
        {status === MetricsApiStatus.Error && <p className="font-display text-lg">Error</p>}
        {status === MetricsApiStatus.Success && noData === true && <p className="font-body text-lg"> No data</p>}
        {status === MetricsApiStatus.Success && noData === false && <p className="font-body text-xl"> {value}ms</p>}
        {status === MetricsApiStatus.Success && noData === false && <div className="py-1" />}
        {status === MetricsApiStatus.Success && noData === false && <p className={`font-body text-sm ${delta > 0 && delta < 1 ? 'text-green-600' : delta > 1 ? 'text-red-400' : ''}`}>{delta > 1 ? `${delta}x slower` : delta > 0 && delta < 1 ? `${delta}x faster` : 'No change'}</p>}
        <span className="pointer-events-none z-50 max-w-xl absolute font-body text-xs text-white rounded-md p-4 bg-neutral-800 left-0 top-0 transform -translate-y-full -mt-4 w-max opacity-0 transition-opacity group-hover:opacity-100">
          App start time = p95 {launchType} launch time of selected app versions<br /><br />Delta value = p95 {launchType} launch time of selected app versions / p95 {launchType} launch time of unselected app versions
        </span>
      </div>
      <div className="py-2" />
      <p className="font-display text-lg">{title}</p>
    </div>
  );
};

export default InfoCircleAppStartTime;
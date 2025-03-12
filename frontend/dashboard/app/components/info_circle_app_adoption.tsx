import React from 'react';
import { MetricsApiStatus } from '../api/api_calls';
import LoadingSpinner from './loading_spinner';

interface InfoCircleAppAdoptionProps {
  status: MetricsApiStatus,
  noData: boolean,
  value: number,
  sessions: number,
  totalSessions: number,
  title: string
}

const formatter = Intl.NumberFormat('en', { notation: 'compact' });

const InfoCircleAppAdoption = ({ status, noData, value, sessions, totalSessions, title }: InfoCircleAppAdoptionProps) => {
  return (
    <div className="flex flex-col items-center">
      <div className={`flex flex-col group relative items-center justify-center w-64 aspect-square rounded-full border border-black border-4 hover:bg-neutral-800/25 transition-colors duration-100`}>
        {status === MetricsApiStatus.Loading && <LoadingSpinner />}
        {status === MetricsApiStatus.Error && <p className="font-display text-lg">Error</p>}
        {status === MetricsApiStatus.Success && noData === true && <p className="font-body text-lg"> No data</p>}
        {status === MetricsApiStatus.Success && noData === false && <p className="font-body text-xl"> {value}%</p>}
        {status === MetricsApiStatus.Success && noData === false && <div className="py-1" />}
        {status === MetricsApiStatus.Success && noData === false && <p className="font-body text-sm">{formatter.format(sessions)}/{formatter.format(totalSessions)} sessions</p>}
        <div className="pointer-events-none z-50 max-w-xl absolute font-body text-xs text-white rounded-md p-4 bg-neutral-800 left-0 top-0 transform -translate-y-full -mt-4 w-max opacity-0 transition-opacity group-hover:opacity-100">
          <p>Adoption =  (Sessions of selected app versions / Sessions of all app versions) * 100</p>
          <div className='py-2' />
          <p>Selected Sessions = {sessions}</p>
          <p>Total Sessions = {totalSessions}</p>
        </div>
      </div>
      <div className="py-2" />
      <p className="font-display text-lg">{title}</p>
    </div>
  );
};

export default InfoCircleAppAdoption;
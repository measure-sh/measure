import React from 'react';


interface InfoCircleAppStartTimeProps {
  value: number;
  delta: number;
  title: string;
  launchType: string;
}

const InfoCircleAppStartTime = ({ value, delta, title, launchType }: InfoCircleAppStartTimeProps) => {
    return (
      <div className="flex flex-col items-center">
          <div className={`flex flex-col group relative items-center justify-center w-64 aspect-square rounded-full border border-4 transition-colors duration-100 ${value < 800? 'border-green-400 hover:bg-green-400/25': value < 1200? 'border-yellow-400 hover:bg-yellow-400/25': 'border-red-400 hover:bg-red-400/25'}`}>
              <p className="text-black font-sans text-xl">{value}ms</p>
              <div className="py-1"/>
              <p className={`font-sans text-sm ${delta < 0? 'text-green-600': delta > 0? 'text-red-400': 'opacity-0'}`}>{delta>0? '+':''}{delta}ms</p>
              <span className="pointer-events-none z-50 max-w-xl absolute font-sans text-sm text-white rounded-md p-4 bg-neutral-800 -top-44 left-0 w-max opacity-0 transition-opacity group-hover:opacity-100">
                App start time = p95 {launchType} launch time of selected app version in selected time period<br/><br/>Delta value = p95 {launchType} launch time of selected app version in selected time period - p95 {launchType} launch time of all app versions in selected time period
              </span>
          </div>
          <div className="py-2"/>
          <p className="text-black font-display text-lg">{title}</p>
      </div>
  );
};

export default InfoCircleAppStartTime;
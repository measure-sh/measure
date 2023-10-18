import React from 'react';


interface InfoCircleAppStartTimeProps {
  value: number;
  delta: number;
  title: string;
}

const InfoCircleAppStartTime = ({ value, delta, title }: InfoCircleAppStartTimeProps) => {
    return (
      <div className="group relative">
        <div className="flex flex-col items-center">
            <div className={`flex flex-col items-center justify-center w-64 aspect-square rounded-full border border-4 ${value < 800? 'border-green-400': value < 1200? 'border-yellow-400': 'border-red-400'}`}>
                <p className="text-black font-sans text-xl">{value}ms</p>
                <div className="py-1"/>
                <p className={`font-sans text-sm ${delta < 0? 'text-green-600': delta > 0? 'text-red-400': 'opacity-0'}`}>{delta>0? '+':''}{delta}ms</p>
            </div>
            <div className="py-2"/>
            <p className="text-black font-display text-lg">{title}</p>
        </div>
        <span className="pointer-events-none z-50 max-w-xl absolute font-sans text-sm text-white rounded-md p-4 bg-neutral-800 -top-40 left-0 w-max opacity-0 transition-opacity group-hover:opacity-100">
          App start time = p95 Cold launch time of selected app version in selected time period<br/><br/>Delta value = p95 Cold launch time of selected app version in selected time period - p95 Cold launch time of all app versions in selected time period
        </span>
      </div>
  );
};

export default InfoCircleAppStartTime;
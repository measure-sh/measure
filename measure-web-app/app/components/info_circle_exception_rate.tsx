import React from 'react';


interface InfoCircleExceptionRateExceptionRateProps {
  value: number;
  delta: number;
  title: string;
}

const InfoCircleExceptionRate = ({ value, delta, title }: InfoCircleExceptionRateExceptionRateProps) => {
    return (
        <div className="flex flex-col items-center">
            <div className={`flex flex-col items-center justify-center w-64 aspect-square rounded-full border border-4 ${value > 95? 'border-green-400': value > 85? 'border-yellow-400': 'border-red-400'}`}>
                <p className="text-black font-sans text-xl">{value}%</p>
                <div className="py-1"/>
                <p className={`font-sans text-sm ${delta > 0? 'text-green-600': delta < 0? 'text-red-400': 'opacity-0'}`}>{delta>0? '+':''}{delta}%</p>
            </div>
            <div className="py-2"/>
            <p className="text-black font-display text-lg">{title}</p>
        </div>
  );
};

export default InfoCircleExceptionRate;
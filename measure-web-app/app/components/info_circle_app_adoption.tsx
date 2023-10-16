import React from 'react';


interface InfoCircleAppAdoptionProps {
  value: number;
  title: string;
}

const InfoCircleAppAdoption = ({ value, title }: InfoCircleAppAdoptionProps) => {
    return (
        <div className="flex flex-col items-center">
            <div className={`flex flex-col items-center justify-center w-64 aspect-square rounded-full border border-4 ${value > 80? 'border-green-400': value > 50? 'border-yellow-400': 'border-red-400'}`}>
                <p className="text-black font-sans text-xl">{value}%</p>
            </div>
            <div className="py-2"/>
            <p className="text-black font-display text-lg">{title}</p>
        </div>
  );
};

export default InfoCircleAppAdoption;
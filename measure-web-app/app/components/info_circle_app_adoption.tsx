import React from 'react';


interface InfoCircleAppAdoptionProps {
  value: number;
  users: number,
  totalUsers: number,
  title: string;
}

const formatter = Intl.NumberFormat('en', { notation: 'compact' });

const InfoCircleAppAdoption = ({ value, users, totalUsers, title }: InfoCircleAppAdoptionProps) => {
    return (
      <div className="group relative">
        <div className="flex flex-col items-center">
            <div className={`flex flex-col items-center justify-center w-64 aspect-square rounded-full border border-black border-4`}>
                <p className="text-black font-sans text-xl">{value}%</p>
                <div className="py-1"/>
                <p className="text-black font-sans text-sm">{formatter.format(users)}/{formatter.format(totalUsers)} users</p>
            </div>
            <div className="py-2"/>
            <p className="text-black font-display text-lg">{title}</p>
        </div>
        <span className="pointer-events-none z-50 max-w-xl absolute font-sans text-sm text-white rounded-md p-4 bg-neutral-800 -top-24 left-0 w-max opacity-0 transition-opacity group-hover:opacity-100">
          Adoption =  (Users of selected app version in selected time period / Users of all app versions in selected time period) * 100
        </span>
      </div>
  );
};

export default InfoCircleAppAdoption;
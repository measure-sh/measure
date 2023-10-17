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
        <div className="flex flex-col items-center">
            <div className={`flex flex-col items-center justify-center w-64 aspect-square rounded-full border border-black border-4`}>
                <p className="text-black font-sans text-xl">{value}%</p>
                <div className="py-1"/>
                <p className="text-black font-sans text-sm">{formatter.format(users)}/{formatter.format(totalUsers)} users</p>
            </div>
            <div className="py-2"/>
            <p className="text-black font-display text-lg">{title}</p>
        </div>
  );
};

export default InfoCircleAppAdoption;
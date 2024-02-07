"use client"

interface PaginatorProps {
  rangeStart: number,
  rangeEnd: number,
  prevDisabled: boolean,
  nextDisabled: boolean,
  onNext: () => void,
  onPrev: () => void;
}

const Paginator: React.FC<PaginatorProps> = ({ rangeStart, rangeEnd, prevDisabled, nextDisabled, onNext, onPrev }) => {
  return (
    <div className="flex flex-row items-center justify-self-center">
      <button disabled={prevDisabled} className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={onPrev}>Previous</button>
      <p className="font-display">{rangeStart} - {rangeEnd}</p>
      <button disabled={nextDisabled} className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black disabled:border-gray-400 rounded-md font-display disabled:text-gray-400 transition-colors duration-100 py-2 px-4" onClick={onNext}>Next</button>
    </div>
  );
};

export default Paginator;
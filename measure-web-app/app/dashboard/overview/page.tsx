import Dropdown from "@/app/components/dropdown";

export default function Overview() {
  const today = new Date();
  const endDate = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

  const sevenDaysAgo = new Date(today.setDate(today.getDate() - 7));
  const startDate = `${sevenDaysAgo.getFullYear()}-${(sevenDaysAgo.getMonth()+1).toString().padStart(2, '0')}-${sevenDaysAgo.getDate().toString().padStart(2, '0')}`;


  return (
    <main className="flex flex-col selection:bg-yellow-200/75">
      <div className="flex flex-col items-start w-full px-16">
        <div className="py-4"/>
        <p className="font-display font-regular text-black text-4xl max-w-6xl text-center">Overview</p>
        <div className="py-4"/>
        <div className="flex flex-wrap gap-x-16 gap-y-4 items-center">
          <Dropdown items={['Readly prod', 'Readly alpha','Readly debug']}/>
          <div className="flex flex-row items-center">
            <input type="date" value={startDate} className="font-display text-black border border-black rounded-md p-2"/>
            <p className="text-black font-display px-2">to</p>
            <input type="date" value={endDate} className="font-display text-black border border-black rounded-md p-2"/>
          </div>
          <Dropdown items={['Version 13.2.1', 'Version 13.2.2','Version 13.3.7']}/>
        </div>
        <div className="py-24"/>
      </div>  
    </main>
  )
}

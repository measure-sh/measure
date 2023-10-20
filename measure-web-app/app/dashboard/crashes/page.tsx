import CheckboxDropdown from "@/app/components/checkbox_dropdown";
import Dropdown from "@/app/components/dropdown";
import ExceptionRateChart from "@/app/components/exception_rate_chart";
import InfoCircleAppAdoption from "@/app/components/info_circle_app_adoption";
import InfoCircleAppSize from "@/app/components/info_circle_app_size";
import InfoCircleAppStartTime from "@/app/components/info_circle_app_start_time";
import InfoCircleExceptionRate from "@/app/components/info_circle_exception_rate";
import UserFlow from "@/app/components/user_flow";

export default function Overview() {
  const today = new Date();
  const endDate = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

  const sevenDaysAgo = new Date(today.setDate(today.getDate() - 7));
  const startDate = `${sevenDaysAgo.getFullYear()}-${(sevenDaysAgo.getMonth()+1).toString().padStart(2, '0')}-${sevenDaysAgo.getDate().toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-16">
      <div className="py-4"/>
      <p className="font-display font-regular text-black text-4xl max-w-6xl text-center">Crashes</p>
      <div className="py-4"/>
      <div className="flex flex-wrap gap-x-16 gap-y-4 items-center">
        <Dropdown items={['Readly prod', 'Readly alpha','Readly debug']}/>
        <div className="flex flex-row items-center">
          <input type="date" value={startDate} className="font-display text-black border border-black rounded-md p-2"/>
          <p className="text-black font-display px-2">to</p>
          <input type="date" value={endDate} className="font-display text-black border border-black rounded-md p-2"/>
        </div>
        <CheckboxDropdown title="App versions" items={['Version 13.2.1', 'Version 13.2.2','Version 13.3.7']}/>
      </div>
      <div className="py-8"/>
      <div className="border border-black text-black font-sans text-sm w-full h-[40rem]">
        <ExceptionRateChart/>
      </div>
      <div className="py-8"/>
    </div>
  )
}

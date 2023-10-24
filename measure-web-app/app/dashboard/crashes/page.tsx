import CheckboxDropdown from "@/app/components/checkbox_dropdown";
import Dropdown from "@/app/components/dropdown";
import ExceptionRateChart from "@/app/components/exception_rate_chart";
import InfoCircleAppAdoption from "@/app/components/info_circle_app_adoption";
import InfoCircleAppSize from "@/app/components/info_circle_app_size";
import InfoCircleAppStartTime from "@/app/components/info_circle_app_start_time";
import InfoCircleExceptionRate from "@/app/components/info_circle_exception_rate";
import UserFlow from "@/app/components/user_flow";
import Link from "next/link";

const crashes = [
  {
    id: 'asldkfjlk34343',
    title: 'NullPointerException.kt',
    count: 87928,
    percentage: 15,
  },
  {
    id: 'sldfkjsklf898',
    title: 'LayoutInflaterException.kt',
    count: 56789,
    percentage: 9,
  },
  {
    id: 'asafdasfd9900',
    title: 'RuntimeException.kt',
    count: 7890,
    percentage: 3,
  },
  {
    id: 'bnflkjfg8989',
    title: 'MainThreadException.kt',
    count: 4546,
    percentage: 1.5,
  },
  {
    id: 'cbcmvncmvn89898',
    title: 'InvalidDataException.kt',
    count: 1031,
    percentage: 0.76,
  },
  {
    id: 'sldkjkjdf8989',
    title: 'JsonParsingException.kt',
    count: 1031,
    percentage: 0.76,
  },
  {
    id: 'sbxcbvcv898',
    title: 'InvalidParameterException.kt',
    count: 1002,
    percentage: 0.73,
  },
  {
    id: 'asdfsdgsdg90909',
    title: 'InvalidDimensionsException.kt',
    count: 856,
    percentage: 0.61,
  },
  {
    id: 'ckvjdfsfjh78aswe',
    title: 'InvalidPaymentMethodException.kt',
    count: 768,
    percentage: 0.51,
  },
  {
    id: 'askjbljhdkfe5435',
    title: 'ApiResponseException.kt',
    count: 652,
    percentage: 0.43,
  },
];

export default function Overview() {
  const today = new Date();
  const endDate = `${today.getFullYear()}-${(today.getMonth()+1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

  const sevenDaysAgo = new Date(today.setDate(today.getDate() - 7));
  const startDate = `${sevenDaysAgo.getFullYear()}-${(sevenDaysAgo.getMonth()+1).toString().padStart(2, '0')}-${sevenDaysAgo.getDate().toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4"/>
      <p className="font-display font-regular text-black text-4xl max-w-6xl text-center">Crashes</p>
      <div className="py-4"/>
      <div className="flex flex-wrap gap-8 items-center w-5/6">
        <Dropdown items={['Readly prod', 'Readly alpha','Readly debug']}/>
        <div className="flex flex-row items-center">
          <input type="date" value={startDate} className="font-display text-black border border-black rounded-md p-2"/>
          <p className="text-black font-display px-2">to</p>
          <input type="date" value={endDate} className="font-display text-black border border-black rounded-md p-2"/>
        </div>
        <CheckboxDropdown title="App versions" items={['Version 13.2.1', 'Version 13.2.2','Version 13.3.7']}/>
        <CheckboxDropdown title="Country" items={['India', 'China','USA']}/>
        <div>
          <p className="font-sans text-black"> Free search: Search by any string such as User ID, Crash string, Device name etc</p>
          <div className="py-1"/>
          <input id="search-string" type="text" placeholder="Enter search string" className="w-full border border-black rounded-md outline-none focus-visible:outline-yellow-300 text-black py-2 px-4 font-sans placeholder:text-neutral-400"/>
        </div>
      </div>
      <div className="py-6"/>
      <div className="border border-black text-black font-sans text-sm w-full h-[36rem]">
        <ExceptionRateChart/>
      </div>
      <div className="py-8"/>
      <div className="table text-black font-sans border border-black w-full">
        <div className="table-header-group border border-black">
          <div className="table-row">
            <div className="table-cell border border-black p-2 font-display">Crash Name</div>
            <div className="table-cell border border-black p-2 font-display text-center">Instances</div>
            <div className="table-cell border border-black p-2 font-display text-center">Percentage contribution</div>
          </div>
        </div>
        <div className="table-row-group">
          {crashes.map(({ id, title, count, percentage }) => (
              <Link key={id} href={`/dashboard/overview/crashes/${id}`} className="table-row hover:bg-yellow-200 active:bg-yellow-300">
                <div className="table-cell border border-black p-2 hover:bg-yellow-200 active:bg-yellow-300">{title}</div>
                <div className="table-cell border border-black p-2 text-center">{count} instances</div>
                <div className="table-cell border border-black p-2 text-center">{percentage}%</div>
              </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

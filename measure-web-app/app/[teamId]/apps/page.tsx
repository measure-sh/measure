import CreateApp from "@/app/components/create_app";
import Dropdown from "@/app/components/dropdown";


export default function Apps({ params }: { params: { teamId: string } }) {
  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4"/>
      <p className="font-display font-regular text-black text-4xl max-w-6xl text-center">Apps</p>
      <div className="py-4"/>
      <Dropdown items={['Readly prod', 'Readly alpha','Readly debug']}/>
      <div className="py-4"/>
      <p className="font-sans">Package name: com.readly.prod</p>
      <p className="font-sans">Platform: Android</p>
      <p className="font-sans">First seen: 13th March, 2019</p>
      <p className="font-sans">First Version: v1.0.3</p>
      <p className="font-sans">Latest Version: v3.1.2</p>
      <div className="py-4"/>
      <p className="font-display font-regular text-black text-xl max-w-6xl text-center">API key</p>
      <div className="flex flex-row items-center">
        <input id="api-key-input" type="text" value="sldkfjslkjljlk45466" className="w-96 border border-black rounded-md outline-none focus-visible:outline-yellow-300 text-black py-2 px-4 font-sans placeholder:text-neutral-400"/>
        <button className="m-4 outline-none flex justify-center hover:bg-yellow-200 active:bg-yellow-300 focus-visible:bg-yellow-200 border border-black rounded-md font-display text-black transition-colors duration-100 py-2 px-4">Copy</button>
      </div>
      <div className="py-8"/>
      <CreateApp teamId={params.teamId}/>
    </div>
  )
}

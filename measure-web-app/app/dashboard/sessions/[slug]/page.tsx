import SessionReplay from "@/app/components/session_replay";

export default function Session({ params }: { params: { slug: string } }) {

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4"/>
      <p className="font-display font-regular text-black text-4xl max-w-6xl text-center">Session: {params.slug}</p>
      <div className="py-6"/>
      <SessionReplay/>
    </div>
  )
}

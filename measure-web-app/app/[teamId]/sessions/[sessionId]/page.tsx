import SessionReplay from "@/app/components/session_replay";

export default function Session({ params }: { params: { sessionId: string } }) {

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-black text-4xl text-center">Session: {params.sessionId}</p>
      <p className="font-sans text-black text-center">UserID: alskdflsj123434</p>
      <p className="font-sans text-black text-center">Date: 24th Oct 2023</p>
      <p className="font-sans text-black text-center">Time: 12:01:00 to 12:08:00</p>
      <p className="font-sans text-black text-center">Device: Samsung Galaxy S9 Pro</p>
      <p className="font-sans text-black text-center">Location: Bangalore, India</p>
      <p className="font-sans text-black text-center">Network provider: Airtel</p>
      <div className="py-6" />
      <SessionReplay />
    </div>
  )
}

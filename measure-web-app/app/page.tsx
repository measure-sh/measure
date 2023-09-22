import Header from './components/header'
import EmailWaitlist from './components/email_waitlist'

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-between selection:bg-yellow-200/75">
      <Header/>
      <div className="flex flex-col items-center md:w-4/5 2xl:w-3/5 px-16">
        <div className="py-24"/>
        <p className="font-display font-regular text-black text-8xl max-w-6xl text-center">measure</p>
        <div className="py-2"/>
        <p className="text-lg leading-relaxed font-sans text-black max-w-2xl text-center">open source monitoring platform for mobile teams</p>
        <div className="py-4 md:py-12"/>
        <div className="border border-black aspect-square w-96 md:w-full bg-yellow-200"/>
        <div className="py-12 md:py-16"/>
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-display font-regular text-black">Measure what matters</p>
            <div className="py-2"/>
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Monitor important release metrics and core user flows to stay on top of app health. Filter by various system or custom attributes for detailed segmentation.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6"/>
          <div className="border border-black w-96 md:w-2/6 aspect-square bg-violet-200"/>
        </div>
        <div className="py-12"/>
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-display font-regular text-black">Crashes</p>
            <div className="py-2"/>
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Track crashes, prioritise them by impact and get clean, de-obfuscated stack traces for precise debugging.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6"/>
          <div className="border border-black w-96 md:w-2/6 aspect-square bg-pink-200"/>
        </div>
        <div className="py-12"/>
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-display font-regular text-black">ANRs & App hangs</p>
            <div className="py-2"/>
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Capture detailed system info to investigate annoying app hangs. Export captured trace data to your favorite analyzer to dig in further. </p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6"/>
          <div className="border border-black w-96 md:w-2/6 aspect-square bg-orange-200"/>
        </div>
        <div className="py-12"/>
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-regular text-black font-display">Performance</p>
            <div className="py-2"/>
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Automatically trace app startup, network calls, database queries and slow page loads. Use custom traces to measure any part of your app.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6"/>
          <div className="border border-black w-96 md:w-2/6 aspect-square bg-blue-200"/>
        </div>
        <div className="py-12"/>
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-display font-regular text-black ">Logs</p>
            <div className="py-2"/>
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Capture standard output/Logcat output automatically. Add custom logs anywhere in your code to effectively diagnose issues in production.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6"/>
          <div className="border border-black w-96 md:w-2/6 aspect-square bg-green-200"/>
        </div>
        <div className="py-12"/>
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-display font-regular text-black">Session replays</p>
            <div className="py-2"/>
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Get play-by-play event timelines with user gestures, network calls, logs, navigation events, screenshots and custom events to root cause production issues quickly.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6"/>
          <div className="border border-black w-96 md:w-2/6 aspect-square bg-purple-200"/>
        </div>
        <div className="py-12"/>
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-display font-regular text-black">AI assistance</p>
            <div className="py-2"/>
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Get AI guidance with full context of your code and platform to help you resolve production bugs. Spend less time on StackOverflow and more time building features.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6"/>
          <div className="border border-black w-96 md:w-2/6 aspect-square bg-rose-200"/>
        </div>
        <div className="py-12"/>
        <div className="flex flex-col md:flex-row md:w-full items-center">
          <div className="flex flex-col md:w-3/6 items-center md:items-start">
            <p className="text-4xl font-display font-regular text-black">Open source</p>
            <div className="py-2"/>
            <p className="text-lg text-center md:text-left leading-relaxed font-sans text-black">Open roadmap. Contributions, issues and pull requests welcome. Standard Apache 2.0 license. No weird clauses. No funny business. No rug pulls.</p>
          </div>
          <div className="py-4 md:py-0 md:w-1/6"/>
          <div className="border border-black w-96 md:w-2/6 aspect-square bg-indigo-200"/>
        </div>
        <div className="py-12 md:py-24"/>
        <p className="font-display font-regular text-black text-6xl max-w-4xl text-center">Measure on every platform</p>
        <div className="py-4 md:py-8"/>
        <div className="flex flex-col md:flex-row items-center">
          <div className="flex flex-col items-center font-display text-neutral-400 border border-neutral-400 rounded-md py-2 px-8">
              <p className="text-center">Android</p>
              <p className="text-xs text-center">In progress</p>
          </div>
          <div className="py-2 md:px-4"/>
          <div className="flex flex-col items-center font-display text-neutral-400 border border-neutral-400 rounded-md py-2 px-8">
              <p className="text-center">iOS</p>
              <p className="text-xs text-center">In progress</p>
          </div>
          <div className="py-2 md:px-4"/>
          <div className="flex flex-col items-center font-display text-neutral-400 border border-neutral-400 rounded-md py-2 px-8">
              <p className="text-center">Flutter</p>
              <p className="text-xs text-center">In progress</p>
          </div>
          <div className="py-2 md:px-4"/>
          <div className="flex flex-col items-center font-display text-neutral-400 border border-neutral-400 rounded-md py-2 px-8">
              <p className="text-center">React Native</p>
              <p className="text-xs text-center">In progress</p>
          </div>
          <div className="py-2 md:px-4"/>
          <div className="flex flex-col items-center font-display text-neutral-400 border border-neutral-400 rounded-md py-2 px-8">
              <p className="text-center">Unity</p>
              <p className="text-xs text-center">In progress</p>
          </div>
        </div>
        <div className="py-12 md:py-24"/>
        <p className="font-display font-regular text-black text-6xl max-w-4xl text-center">Early access</p>
        <div className="py-2"/>
        <p className="font-sans text-black text-xl leading-relaxed max-w-4xl text-center">Monitoring mobile apps in production doesn&apos;t have to be hard. Sign up to get early access to measure!</p>
        <div className="py-4"/>
        <EmailWaitlist/>
        <div className="py-24"/>
      </div>
      
    </main>
  )
}

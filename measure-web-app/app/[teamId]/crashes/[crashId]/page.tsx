"use client"

import React, { useState, useEffect } from 'react';
import Accordion from "@/app/components/accordion";
import CheckboxDropdown from "@/app/components/checkbox_dropdown";
import Dropdown from "@/app/components/dropdown";
import ExceptionCountChart from "@/app/components/exception_count_chart";
import FilterPill from "@/app/components/filter_pill";
import UserFlowCrashDetails from "@/app/components/user_flow_crash_details";
import Link from "next/link";

const sessions = [
  {
    id: 'asldkfjlk34343',
    userId: 'dlsfjldsjf3434',
    dateTime: '24 Oct 2023, 1.32 PM'
  },
  {
    id: 'sldfkjsklf898',
    userId: 'nvcmv8998',
    dateTime: '24 Oct 2023, 12.45 PM'
  },
  {
    id: 'asafdasfd9900',
    userId: 'sldjflds787',
    dateTime: '24 Oct 2023, 12.30 PM'
  },
  {
    id: 'bnflkjfg8989',
    userId: 'svdlifu87987',
    dateTime: '23 Oct 2023, 10.05 PM'
  },
  {
    id: 'cbcmvncmvn89898',
    userId: 'blkhf234',
    dateTime: '23 Oct 2023, 9.45 PM'
  },
  {
    id: 'sldkjkjdf8989',
    userId: 'kjgdf7879',
    dateTime: '23 Oct 2023, 11.13 AM'
  },
  {
    id: 'sbxcbvcv898',
    userId: 'asdf8787',
    dateTime: '22 Oct 2023, 9.06 PM'
  },
  {
    id: 'asdfsdgsdg90909',
    userId: 'asvjhjhf23434',
    dateTime: '22 Oct 2023, 6.03 PM'
  },
  {
    id: 'ckvjdfsfjh78aswe',
    userId: 'asvjhjhf23434',
    dateTime: '22 Oct 2023, 3.07 PM'
  },
  {
    id: 'askjbljhdkfe5435',
    userId: 'jklj78979',
    dateTime: '22 Oct 2023, 10.53 AM'
  },
];

const stackTraces = [
  {
    title: "UI thread",
    text: `FATAL EXCEPTION: main
    java.lang.RuntimeException: Unable to start activity ComponentInfo{com.testing.ringer/com.testing.ringer.RingerActivity}: java.lang.NullPointerException
       at android.app.ActivityThread.performLaunchActivity(ActivityThread.java:1872)
       at android.app.ActivityThread.handleLaunchActivity(ActivityThread.java:1893)
       at android.app.ActivityThread.access$1500(ActivityThread.java:135)
       at android.app.ActivityThread$H.handleMessage(ActivityThread.java:1054)
       at android.os.Handler.dispatchMessage(Handler.java:99)
       at android.os.Looper.loop(Looper.java:150)
       at android.app.ActivityThread.main(ActivityThread.java:4385)
       at java.lang.reflect.Method.invokeNative(Native Method)
       at java.lang.reflect.Method.invoke(Method.java:507)
       at com.android.internal.os.ZygoteInit$MethodAndArgsCaller.run(ZygoteInit.java:849)
       at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:607)
       at dalvik.system.NativeStart.main(Native Method)
    Caused by: java.lang.NullPointerException
       at com.testing.ringer.RingerActivity.onCreate(RingerActivity.java:23)
       at android.app.Instrumentation.callActivityOnCreate(Instrumentation.java:1072)
       at android.app.ActivityThread.performLaunchActivity(ActivityThread.java:1836)
       ... 11 more`,
    active: true,
  },
  {
    title: "Thread 1",
    text: `FATAL EXCEPTION: main
    java.lang.RuntimeException: Unable to start activity ComponentInfo{com.testing.ringer/com.testing.ringer.RingerActivity}: java.lang.NullPointerException
       at android.app.ActivityThread.performLaunchActivity(ActivityThread.java:1872)
       at android.app.ActivityThread.handleLaunchActivity(ActivityThread.java:1893)
       at android.app.ActivityThread.access$1500(ActivityThread.java:135)
       at android.app.ActivityThread$H.handleMessage(ActivityThread.java:1054)
       at android.os.Handler.dispatchMessage(Handler.java:99)
       at android.os.Looper.loop(Looper.java:150)
       at android.app.ActivityThread.main(ActivityThread.java:4385)
       at java.lang.reflect.Method.invokeNative(Native Method)
       at java.lang.reflect.Method.invoke(Method.java:507)
       at com.android.internal.os.ZygoteInit$MethodAndArgsCaller.run(ZygoteInit.java:849)
       at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:607)
       at dalvik.system.NativeStart.main(Native Method)
    Caused by: java.lang.NullPointerException
       at com.testing.ringer.RingerActivity.onCreate(RingerActivity.java:23)
       at android.app.Instrumentation.callActivityOnCreate(Instrumentation.java:1072)
       at android.app.ActivityThread.performLaunchActivity(ActivityThread.java:1836)
       ... 11 more`,
    active: false,
  },
  {
    title: "Thread 2",
    text: `FATAL EXCEPTION: main
    java.lang.RuntimeException: Unable to start activity ComponentInfo{com.testing.ringer/com.testing.ringer.RingerActivity}: java.lang.NullPointerException
       at android.app.ActivityThread.performLaunchActivity(ActivityThread.java:1872)
       at android.app.ActivityThread.handleLaunchActivity(ActivityThread.java:1893)
       at android.app.ActivityThread.access$1500(ActivityThread.java:135)
       at android.app.ActivityThread$H.handleMessage(ActivityThread.java:1054)
       at android.os.Handler.dispatchMessage(Handler.java:99)
       at android.os.Looper.loop(Looper.java:150)
       at android.app.ActivityThread.main(ActivityThread.java:4385)
       at java.lang.reflect.Method.invokeNative(Native Method)
       at java.lang.reflect.Method.invoke(Method.java:507)
       at com.android.internal.os.ZygoteInit$MethodAndArgsCaller.run(ZygoteInit.java:849)
       at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:607)
       at dalvik.system.NativeStart.main(Native Method)
    Caused by: java.lang.NullPointerException
       at com.testing.ringer.RingerActivity.onCreate(RingerActivity.java:23)
       at android.app.Instrumentation.callActivityOnCreate(Instrumentation.java:1072)
       at android.app.ActivityThread.performLaunchActivity(ActivityThread.java:1836)
       ... 11 more`,
    active: false,
  },
  {
    title: "Thread 3",
    text: `FATAL EXCEPTION: main
    java.lang.RuntimeException: Unable to start activity ComponentInfo{com.testing.ringer/com.testing.ringer.RingerActivity}: java.lang.NullPointerException
       at android.app.ActivityThread.performLaunchActivity(ActivityThread.java:1872)
       at android.app.ActivityThread.handleLaunchActivity(ActivityThread.java:1893)
       at android.app.ActivityThread.access$1500(ActivityThread.java:135)
       at android.app.ActivityThread$H.handleMessage(ActivityThread.java:1054)
       at android.os.Handler.dispatchMessage(Handler.java:99)
       at android.os.Looper.loop(Looper.java:150)
       at android.app.ActivityThread.main(ActivityThread.java:4385)
       at java.lang.reflect.Method.invokeNative(Native Method)
       at java.lang.reflect.Method.invoke(Method.java:507)
       at com.android.internal.os.ZygoteInit$MethodAndArgsCaller.run(ZygoteInit.java:849)
       at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:607)
       at dalvik.system.NativeStart.main(Native Method)
    Caused by: java.lang.NullPointerException
       at com.testing.ringer.RingerActivity.onCreate(RingerActivity.java:23)
       at android.app.Instrumentation.callActivityOnCreate(Instrumentation.java:1072)
       at android.app.ActivityThread.performLaunchActivity(ActivityThread.java:1836)
       ... 11 more`,
    active: false,
  },
  {
    title: "Thread 4",
    text: `FATAL EXCEPTION: main
    java.lang.RuntimeException: Unable to start activity ComponentInfo{com.testing.ringer/com.testing.ringer.RingerActivity}: java.lang.NullPointerException
       at android.app.ActivityThread.performLaunchActivity(ActivityThread.java:1872)
       at android.app.ActivityThread.handleLaunchActivity(ActivityThread.java:1893)
       at android.app.ActivityThread.access$1500(ActivityThread.java:135)
       at android.app.ActivityThread$H.handleMessage(ActivityThread.java:1054)
       at android.os.Handler.dispatchMessage(Handler.java:99)
       at android.os.Looper.loop(Looper.java:150)
       at android.app.ActivityThread.main(ActivityThread.java:4385)
       at java.lang.reflect.Method.invokeNative(Native Method)
       at java.lang.reflect.Method.invoke(Method.java:507)
       at com.android.internal.os.ZygoteInit$MethodAndArgsCaller.run(ZygoteInit.java:849)
       at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:607)
       at dalvik.system.NativeStart.main(Native Method)
    Caused by: java.lang.NullPointerException
       at com.testing.ringer.RingerActivity.onCreate(RingerActivity.java:23)
       at android.app.Instrumentation.callActivityOnCreate(Instrumentation.java:1072)
       at android.app.ActivityThread.performLaunchActivity(ActivityThread.java:1836)
       ... 11 more`,
    active: false,
  },
]

export default function CrashDetails({ params }: { params: { teamId: string, crashId: string } }) {
  var apps = ['Readly prod', 'Readly alpha', 'Readly debug'];
  const [selectedApp, setSelectedApp] = useState(apps[0]);

  var versions = ['Version 13.2.1', 'Version 13.2.2', 'Version 13.3.7'];
  const [selectedVersions, setSelectedVersions] = useState(new Array<string>());

  var countries = ['India', 'China', 'USA'];
  const [selectedCountries, setSelectedCountries] = useState(new Array<string>());

  var networkProviders = ['Airtel', 'Jio', 'Vodafone'];
  const [selectedNetworkProviders, setSelectedNetworkProviders] = useState(new Array<string>());

  var networkTypes = ['Wifi', '5G', '4G', '3G', '2G', 'Edge'];
  const [selectedNetworkTypes, setSelectedNetworkTypes] = useState(new Array<string>());

  var locales = ['en-in', 'en-us', 'en-uk'];
  const [selectedLocales, setSelectedLocales] = useState(new Array<string>());

  var deviceManufacturers = ['Samsung', 'Huawei', 'Motorola'];
  const [selectedDeviceManufacturers, setSelectedDeviceManufacturers] = useState(new Array<string>());

  var deviceNames = ['Samsung Galaxy Note 2', 'Motorola Razor V2', 'Huawei P30 Pro']
  const [selectedDeviceNames, setSelectedDeviceNames] = useState(new Array<string>());

  const today = new Date();
  var initialEndDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const [endDate, setEndDate] = useState(initialEndDate);
  const [formattedEndDate, setFormattedEndDate] = useState(endDate);

  const sevenDaysAgo = new Date(today.setDate(today.getDate() - 7));
  var initialStartDate = `${sevenDaysAgo.getFullYear()}-${(sevenDaysAgo.getMonth() + 1).toString().padStart(2, '0')}-${sevenDaysAgo.getDate().toString().padStart(2, '0')}`;
  const [startDate, setStartDate] = useState(initialStartDate);
  const [formattedStartDate, setFormattedStartDate] = useState(startDate);

  useEffect(() => {
    setFormattedStartDate(new Date(startDate).toLocaleDateString());
    setFormattedEndDate(new Date(endDate).toLocaleDateString());
  }, [startDate, endDate]);

  return (
    <div className="flex flex-col selection:bg-yellow-200/75 items-start p-24 pt-8">
      <div className="py-4" />
      <p className="font-display font-regular text-black text-4xl max-w-6xl text-center">NullPointerException.java</p>
      <div className="py-4" />
      <div className="flex flex-wrap gap-8 items-center w-5/6">
        <Dropdown items={apps} onChangeSelectedItem={(item) => setSelectedApp(item)} />
        <div className="flex flex-row items-center">
          <input type="date" defaultValue={startDate} max={endDate} className="font-display text-black border border-black rounded-md p-2" onChange={(e) => setStartDate(e.target.value)} />
          <p className="text-black font-display px-2">to</p>
          <input type="date" defaultValue={endDate} min={startDate} className="font-display text-black border border-black rounded-md p-2" onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <CheckboxDropdown title="App versions" items={versions} onChangeSelectedItems={(items) => setSelectedVersions(items)} />
        <CheckboxDropdown title="Country" items={countries} onChangeSelectedItems={(items) => setSelectedCountries(items)} />
        <CheckboxDropdown title="Network Provider" items={networkProviders} onChangeSelectedItems={(items) => setSelectedNetworkProviders(items)} />
        <CheckboxDropdown title="Network type" items={networkTypes} onChangeSelectedItems={(items) => setSelectedNetworkTypes(items)} />
        <CheckboxDropdown title="Locale" items={locales} onChangeSelectedItems={(items) => setSelectedLocales(items)} />
        <CheckboxDropdown title="Device Manufacturer" items={deviceManufacturers} onChangeSelectedItems={(items) => setSelectedDeviceManufacturers(items)} />
        <CheckboxDropdown title="Device Name" items={deviceNames} onChangeSelectedItems={(items) => setSelectedDeviceNames(items)} />
        <div className="w-full">
          <p className="font-sans text-black">Filter by any field such as userId, device name etc</p>
          <div className="py-1" />
          <input id="search-string" type="text" placeholder="userId: abcde123, deviceName: Samsung Galaxy" className="w-full border border-black rounded-md outline-none focus-visible:outline-yellow-300 text-black py-2 px-4 font-sans placeholder:text-neutral-400" />
        </div>
      </div>
      <div className="py-4" />
      <div className="flex flex-wrap gap-2 items-center w-5/6">
        <FilterPill title={selectedApp} />
        <FilterPill title={`${formattedStartDate} to ${formattedEndDate}`} />
        {selectedVersions.length > 0 && <FilterPill title={Array.from(selectedVersions).join(', ')} />}
        {selectedCountries.length > 0 && <FilterPill title={Array.from(selectedCountries).join(', ')} />}
        {selectedNetworkProviders.length > 0 && <FilterPill title={Array.from(selectedNetworkProviders).join(', ')} />}
        {selectedNetworkTypes.length > 0 && <FilterPill title={Array.from(selectedNetworkTypes).join(', ')} />}
        {selectedLocales.length > 0 && <FilterPill title={Array.from(selectedLocales).join(', ')} />}
        {selectedDeviceManufacturers.length > 0 && <FilterPill title={Array.from(selectedDeviceManufacturers).join(', ')} />}
        {selectedDeviceNames.length > 0 && <FilterPill title={Array.from(selectedDeviceNames).join(', ')} />}
      </div>
      <div className="py-6" />
      <div className="flex flex-col md:flex-row w-full">
        <div className="border border-black text-black font-sans text-sm w-full h-[24rem]">
          <ExceptionCountChart />
        </div>
        <div className="p-2" />
        <div className="border border-black text-black font-sans text-sm w-full h-[24rem]">
          <UserFlowCrashDetails />
        </div>
      </div>
      <div className="py-8" />
      <p className="text-black font-display text-3xl"> Stack trace</p>
      <div className="py-2" />
      <div>
        {stackTraces.map((stackTrace, index) => (
          <Accordion key={index} title={stackTrace.title} id={`stackTraces-${index}`} active={stackTrace.active}>
            {stackTrace.text}
          </Accordion>
        ))}
      </div>
      <div className="py-8" />
      <p className="text-black font-display text-3xl"> Latest Sessions with NullpointerException.java</p>
      <div className="py-4" />
      <div className="table text-black font-sans border border-black w-full">
        <div className="table-header-group border border-black">
          <div className="table-row">
            <div className="table-cell border border-black p-2 font-display text-center">Session ID</div>
            <div className="table-cell border border-black p-2 font-display text-center">User ID</div>
            <div className="table-cell border border-black p-2 font-display text-center">Session time</div>
          </div>
        </div>
        <div className="table-row-group">
          {sessions.map(({ id, userId, dateTime }) => (
            <Link key={id} href={`/${params.teamId}/sessions/${id}`} className="table-row hover:bg-yellow-200 active:bg-yellow-300">
              <div className="table-cell border border-black p-2 text-center">{id}</div>
              <div className="table-cell border border-black p-2 text-center">{userId}</div>
              <div className="table-cell border border-black p-2 text-center">{dateTime}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

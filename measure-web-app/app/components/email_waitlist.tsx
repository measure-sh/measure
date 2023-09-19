'use client'

import { useState } from 'react';
import type { FC, FormEventHandler } from 'react';

const waitlist = 'clmq44pdk0002l509qxe27qr8';

export enum ApiStatus {
    INIT = 'init',
    PENDING = 'pending',
    SUCCESS = 'success',
    ERROR = 'error',
  }

const EmailWaitlist: FC = () => {
  const [email, setEmail] = useState('');
  const [apiStatus, setApiStatus] = useState<ApiStatus>(ApiStatus.INIT)
  const [buttonText, setButtonText] = useState('Notify Me');
  const [errorText, setErrorText] = useState('');

  const handleSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    try {
      setApiStatus(ApiStatus.PENDING);
      setButtonText('Processing...');

      const response = await fetch('https://www.waitlist.email/api/subscribers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Waitlist-Api-Key': 'clmq44pdk0003l509crk9eexw'
        },
        body: JSON.stringify({
          waitlist,
          email
        }),
      });

      const body = (await response.json()) as { message: string };

      if (!response.ok) {
        throw new Error(body.message);
      }

      setApiStatus(ApiStatus.SUCCESS);
      setButtonText('Subscribed!');
      setErrorText('')
    } catch (error) {
        if(error instanceof Error) {
            setErrorText(error.message);
        } else {
            setErrorText('Something went wrong :-(. Please try again.')
        }
        setApiStatus(ApiStatus.ERROR);
        setButtonText('Notify Me');
    }
  };

  return (
    <div id="email-waitlist" className="flex flex-col items-center">
        <form onSubmit={handleSubmit} className="flex flex-row items-center">
            <input id="email" type="email" placeholder="Your email address" className="w-4xl border border-black rounded-md outline-none focus-visible:outline-yellow-300 text-black py-2 px-4 font-sans placeholder:text-neutral-400"value={email} onChange={(event) => setEmail(event.target.value)} />
            <div className="px-2"/>
            <button type="submit" disabled={apiStatus === ApiStatus.PENDING || apiStatus === ApiStatus.SUCCESS || email.length === 0} className={`outline-none hover:bg-yellow-200 focus-visible:bg-yellow-200 active:bg-yellow-300 font-display text-black border border-black rounded-md transition-colors duration-100 py-2 px-4 ${(apiStatus === ApiStatus.PENDING || apiStatus == ApiStatus.SUCCESS) ? 'pointer-events-none' : 'pointer-events-auto'}`}>{buttonText}</button>
        </form>
        <div className="py-2"/>
        <p className={`font-sans text-pink-600 text-sm ${apiStatus === ApiStatus.ERROR ? '' : 'opacity-0'}`}>{errorText}</p>
    </div>
  );
};

export default EmailWaitlist;
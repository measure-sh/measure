"use client"

import LandingHeader from '../components/landing_header'


import Link from 'next/link'
import { buttonVariants } from '../components/button'
import LandingFooter from '../components/landing_footer'
import { cn } from '../utils/shadcn_utils'
import { underlineLinkStyle } from '../utils/shared_styles'

export default function PrivacyPolicy() {

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">

        {/* Main description */}
        <div className="py-16" />
        <div className="max-w-6xl mx-auto px-4 py-8 font-body">
          {/* Header */}
          <h1 className="text-5xl font-display mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Updated: September 10, 2025</p>

          {/* Introduction */}
          <p className="mb-4 text-justify text-lg">
            This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.
          </p>
          <p className="mb-4 text-justify text-lg">
            We use Your Personal data to provide and improve the Service. By using the Service, You agree to the collection and use of information in accordance with this Privacy Policy.
          </p>
          <h2 className="text-3xl font-display mt-12 mb-4">Scope</h2>
          <p className="mb-4 text-justify text-lg">
            This Privacy Policy covers our treatment of personal data (&quot;Personal Data&quot;) that we gather when you access or otherwise use the Service. It explains what data we collect, why we collect the data, how it is used and your rights and choices. While providing our Service, we may collect information about our customers&apos; end-users at the direction of and on behalf of our customers. Our use of this information is governed by our agreement with the applicable customer and the customers&apos; privacy policies. We do not control and are not responsible for the privacy policies or privacy practices of our customers or any other third parties. We encourage you to review any such policies or practices that apply to you carefully.
          </p>

          {/* Interpretation and Definitions */}
          <h2 className="text-3xl font-display mt-12 mb-4">Interpretation and Definitions</h2>

          <h3 className="text-2xl font-display mt-6 mb-3">Interpretation</h3>
          <p className="mb-6 text-justify text-lg">
            The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.
          </p>

          <h3 className="text-2xl font-display mt-6 mb-3">Definitions</h3>
          <p className="mb-4 text-justify text-lg">For the purposes of this Privacy Policy:</p>

          <dl className="mb-8 space-y-4 text-lg">
            <div>
              <dt className="font-semibold">Account</dt>
              <dd className="mt-1 text-justify">means a unique account created for you to access our Service or parts of our Service.</dd>
            </div>

            <div>
              <dt className="font-semibold">Affiliate</dt>
              <dd className="mt-1 text-justify">means an entity that controls, is controlled by or is under common control with a party, where &quot;control&quot; means ownership of 50% or more of the shares, equity interest or other securities entitled to vote for election of directors or other managing authority.</dd>
            </div>

            <div>
              <dt className="font-semibold">Company</dt>
              <dd className="mt-1 text-justify">(referred to as &quot;the Company&quot;, &quot;We&quot;,&quot;we&quot;, &quot;Us&quot;, &quot;us&quot;, &quot;Our&quot; or &quot;our&quot; in this Agreement) refers to Measure Inc., 8 The Green, Ste A, Dover, DE 19901.</dd>
            </div>

            <div>
              <dt className="font-semibold">Cookies</dt>
              <dd className="mt-1 text-justify">are small files that are placed on your computer, mobile device or any other device by a website, containing the details of your browsing history on that website among its many uses.</dd>
            </div>

            <div>
              <dt className="font-semibold">Country</dt>
              <dd className="mt-1 text-justify">refers to: Delaware, United States</dd>
            </div>

            <div>
              <dt className="font-semibold">Device</dt>
              <dd className="mt-1 text-justify">means any device that can access the Service such as a computer, a cellphone or a digital tablet.</dd>
            </div>

            <div>
              <dt className="font-semibold">Personal Data</dt>
              <dd className="mt-1 text-justify">is any information that relates to an identified or identifiable individual in connection with your account and use of our Service. This includes information such as your name, email address, and payment information.</dd>
            </div>

            <div>
              <dt className="font-semibold">Service</dt>
              <dd className="mt-1 text-justify">refers to the Website and the software application provided by the Company.</dd>
            </div>

            <div>
              <dt className="font-semibold">Service Provider</dt>
              <dd className="mt-1 text-justify">means any natural or legal person who processes the data on behalf of the Company. It refers to third-party companies or individuals employed by the Company to facilitate the Service, to provide the Service on behalf of the Company, to perform services related to the Service or to assist the Company in analyzing how the Service is used.</dd>
            </div>

            <div>
              <dt className="font-semibold">Usage Data</dt>
              <dd className="mt-1 text-justify">refers to data collected automatically, either generated by the use of the Service or from the Service infrastructure itself (for example, the duration of a page visit).</dd>
            </div>

            <div>
              <dt className="font-semibold">Website</dt>
              <dd className="mt-1 text-justify">refers to measure.sh, accessible from <Link target="_blank" className={underlineLinkStyle} href="https://measure.sh">https://measure.sh</Link></dd>
            </div>

            <div>
              <dt className="font-semibold">You/Your</dt>
              <dd className="mt-1 text-justify">(referred to as &quot;You&quot;, &quot;you&quot;, &quot;Your&quot; or &quot;your&quot; in this Agreement) is the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service, as applicable.</dd>
            </div>
          </dl>

          {/* Types of Data Collected */}
          <h2 className="text-3xl font-display mt-12 mb-4">Types of Data Collected</h2>
          <p className="mb-6 text-justify text-lg">
            We collect and process two distinct categories of data when you use our Service: Personal Data about you as a user, and Monitoring Data that you send to our platform for monitoring purposes. These are separate categories with different purposes, uses, and retention policies.
          </p>

          <h3 className="text-2xl font-display mt-6 mb-3">Personal Data</h3>
          <p className="mb-4 text-justify text-lg">
            While using our Service, we may ask you to provide us with certain personally identifiable information that can be used to contact or identify you and manage your account. Personally identifiable information may include, but is not limited to:
          </p>
          <ul className="list-disc ml-6 mb-6 space-y-1 text-lg">
            <li>Email address</li>
            <li>First name and last name</li>
            <li>Payment Information - If you purchase a subscription, we collect data necessary to process your payment. We do not store full credit card numbers; these are processed by our third-party payment processors.</li>
          </ul>

          <h3 className="text-2xl font-display mt-6 mb-3">Usage Data</h3>
          <p className="mb-4 text-justify text-lg">
            Usage Data is collected automatically when using the Service.
          </p>
          <p className="mb-4 text-justify text-lg">
            Usage Data may include information such as your Device&apos;s Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that you visit, the time and date of your visit, the time spent on those pages, unique device identifiers and other diagnostic data.
          </p>
          <p className="mb-4 text-justify text-lg">
            When you access the Service by or through a mobile device, we may collect certain information automatically, including, but not limited to, the type of mobile device you use, your mobile device unique ID, the IP address of your mobile device, your mobile operating system, the type of mobile Internet browser you use, unique device identifiers and other diagnostic data.
          </p>
          <p className="mb-8 text-justify text-lg">
            We may also collect information that your browser sends whenever you visit our Service or when you access the Service by or through a mobile device.
          </p>

          {/* Tracking Technologies and Cookies */}
          <h2 className="text-3xl font-display mt-12 mb-4">Tracking Technologies and Cookies</h2>
          <p className="mb-4 text-justify text-lg">
            We use Cookies and similar tracking technologies to track the activity on our Service and store certain information. Tracking technologies used are beacons, tags, and scripts to collect and track information and to improve and analyze our Service. The technologies we use may include:
          </p>

          <ul className="list-disc ml-6 mb-6 space-y-3 text-lg">
            <li className="text-justify">
              <strong>Cookies or Browser Cookies.</strong> A cookie is a small file placed on your Device. You can instruct your browser to refuse all Cookies or to indicate when a Cookie is being sent. However, if you do not accept Cookies, you may not be able to use some parts of our Service. Unless you have adjusted your browser setting so that it will refuse Cookies, our Service may use Cookies.
            </li>
            <li className="text-justify">
              <strong>Web Beacons.</strong> Certain sections of our Service and our emails may contain small electronic files known as web beacons (also referred to as clear gifs, pixel tags, and single-pixel gifs) that permit the Company, for example, to count users who have visited those pages or opened an email and for other related website statistics (for example, recording the popularity of a certain section and verifying system and server integrity).
            </li>
          </ul>

          <p className="mb-4 text-justify text-lg">
            Cookies can be &quot;Persistent&quot; or &quot;Session&quot; Cookies. Persistent Cookies remain on your personal computer or mobile device when you go offline, while Session Cookies are deleted as soon as you close your web browser.
          </p>

          <p className="mb-4 text-justify text-lg">
            We use both Session and Persistent Cookies for the purposes set out below:
          </p>

          <div className="mb-6 space-y-4 text-lg">
            <div>
              <h4 className="font-semibold mb-2">Necessary / Essential Cookies</h4>
              <p className="mb-1"><strong>Type:</strong> Session Cookies</p>
              <p className="mb-1"><strong>Administered by:</strong> Us</p>
              <p className="text-justify"><strong>Purpose:</strong> These Cookies are essential to provide you with services available through the Website and to enable you to use some of its features. They help to authenticate users and prevent fraudulent use of user accounts. Without these Cookies, the services that you have asked for cannot be provided, and we only use these Cookies to provide you with those services.</p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Functionality Cookies</h4>
              <p className="mb-1"><strong>Type:</strong> Persistent Cookies</p>
              <p className="mb-1"><strong>Administered by:</strong> Us</p>
              <p className="text-justify"><strong>Purpose:</strong> These Cookies allow us to remember choices you make when you use the Website, such as remembering your login details or language preference. The purpose of these Cookies is to provide you with a more personal experience and to avoid you having to re-enter your preferences every time you use the Website.</p>
            </div>
          </div>

          {/* Use of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">Use of Your Personal Data</h2>
          <p className="mb-4 text-justify text-lg">
            The Company may use Personal Data for the following purposes:
          </p>

          <ul className="list-disc ml-6 mb-6 space-y-3 text-lg">
            <li className="text-justify">
              <strong>To provide and maintain our Service,</strong> including to monitor the usage of our Service.
            </li>
            <li className="text-justify">
              <strong>To manage your Account:</strong> to manage your registration as a user of the Service. The Personal Data you provide can give you access to different functionalities of the Service that are available to you as a registered user.
            </li>
            <li className="text-justify">
              <strong>For the performance of a contract:</strong> the development, compliance and undertaking of the purchase contract for the products, items or services you have purchased or of any other contract with us through the Service.
            </li>
            <li className="text-justify">
              <strong>To contact you:</strong> To contact you by email, telephone calls, SMS, or other equivalent forms of electronic communication, such as a mobile application&apos;s push notifications regarding updates or informative communications related to the functionalities, products or contracted services, including the security updates, when necessary or reasonable for their implementation.
            </li>
            <li className="text-justify">
              <strong>To provide you</strong> with news, special offers and general information about other goods, services and events which we offer that are similar to those that you have already purchased or enquired about unless you have opted not to receive such information.
            </li>
            <li className="text-justify">
              <strong>To manage your requests:</strong> To attend and manage your requests to us.
            </li>
            <li className="text-justify">
              <strong>For business transfers:</strong> We may use your information to evaluate or conduct a merger, divestiture, restructuring, reorganization, dissolution, or other sale or transfer of some or all of our assets, whether as a going concern or as part of bankruptcy, liquidation, or similar proceeding, in which Personal Data held by us about our Service users is among the assets transferred.
            </li>
            <li className="text-justify">
              <strong>For other purposes:</strong> We may use your information for other purposes, such as data analysis, identifying usage trends, determining the effectiveness of our promotional campaigns and to evaluate and improve our Service, products, services, marketing and your experience.
            </li>
          </ul>

          <p className="mb-4 text-justify text-lg">
            We may share your personal information in the following situations:
          </p>

          <ul className="list-disc ml-6 mb-8 space-y-3 text-lg">
            <li className="text-justify">
              <strong>With Service Providers:</strong> We may share your personal account information with Service Providers to monitor and analyze the use of our Service, to contact you, and to process payments.
            </li>
            <li className="text-justify">
              <strong>For business transfers:</strong> We may share or transfer your personal information in connection with, or during negotiations of, any merger, sale of Company assets, financing, or acquisition of all or a portion of our business to another company.
            </li>
            <li className="text-justify">
              <strong>With Affiliates:</strong> We may share your information with our affiliates, in which case we will require those affiliates to honor this Privacy Policy. Affiliates include our parent company and any other subsidiaries, joint venture partners or other companies that we control or that are under common control with us.
            </li>
            <li className="text-justify">
              <strong>With business partners:</strong> We may share your account information with our business partners to offer you certain products, services or promotions.
            </li>
            <li className="text-justify">
              <strong>With other users:</strong> When you share personal information or otherwise interact in public areas with other users, such information may be viewed by all users and may be publicly distributed outside.
            </li>
            <li className="text-justify">
              <strong>With Your consent:</strong> We may disclose your personal information for any other purpose with your consent.
            </li>
          </ul>

          {/* Retention of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">Retention of Your Personal Data</h2>
          <p className="mb-4 text-justify text-lg">
            The Company will retain your Personal Data (such as your name, email address, account information, and payment details—but NOT your Monitoring Data) only for as long as is necessary for the purposes set out in this Privacy Policy. Specifically:
          </p>
          <ul className="list-disc ml-6 mb-6 space-y-2 text-lg">
            <li className="text-justify">
              While your account is active, we retain your Personal Data to provide you with the Service and manage your account.
            </li>
            <li className="text-justify">
              After account closure or subscription termination, we will retain your Personal Data to the extent necessary to comply with our legal obligations (for example, if we are required to retain your data to comply with applicable laws, tax regulations, or accounting requirements), resolve disputes, enforce our legal agreements and policies, and prevent fraud.
            </li>
            <li className="text-justify">
              We will also retain Usage Data for internal analysis purposes. Usage Data is generally retained for a shorter period of time, except when this data is used to strengthen the security or to improve the functionality of our Service, or we are legally obligated to retain this data for longer time periods.
            </li>
          </ul>

          {/* Transfers of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">Transfers of Your Personal Data</h2>
          <p className="mb-4 text-justify text-lg">
            Your information, including Personal Data, is processed at the Company&apos;s operating offices and in any other places where the parties involved in the processing are located. It means that this information may be transferred to and maintained on computers located outside of your state, province, country or other governmental jurisdiction where the data protection laws may differ than those from your jurisdiction.
          </p>
          <p className="mb-4 text-justify text-lg">
            Your consent to this Privacy Policy followed by your submission of such information represents your agreement to that transfer.
          </p>
          <p className="mb-8 text-justify text-lg">
            The Company will take all steps reasonably necessary to ensure that your Personal Data is treated securely and in accordance with this Privacy Policy and no transfer of your data will take place to an organization or a country unless there are adequate controls in place including the security of your data and other information.
          </p>

          {/* Deletion of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">Deletion of Your Personal Data</h2>
          <p className="mb-4 text-justify text-lg">
            You have the right to delete or request that we assist in deleting the Personal Data (account information, contact details, payment information) that we have collected about you.
          </p>
          <p className="mb-4 text-justify text-lg">
            Our Service may give you the ability to delete certain information about you from within the Service.
          </p>
          <p className="mb-4 text-justify text-lg">
            You may update, amend, or delete your Personal Data at any time by signing in to your Account, if you have one, and visiting the account settings section that allows you to manage your personal information. You may also contact us to request access to, correct, or delete any Personal Data that you have provided to us.
          </p>
          <p className="mb-6 text-justify text-lg">
            Please note, however, that we may need to retain certain Personal Data when we have a legal obligation or lawful basis to do so.
          </p>

          {/* Disclosure of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">Disclosure of Your Personal Data</h2>
          <h3 className="text-xl font-display mt-6 mb-3">Business Transactions</h3>
          <p className="mb-6 text-justify text-lg">
            If the Company is involved in a merger, acquisition or asset sale, your Personal Data may be transferred. We will provide notice before your data is transferred and becomes subject to a different Privacy Policy.
          </p>

          <h3 className="text-xl font-display mt-6 mb-3">Law enforcement</h3>
          <p className="mb-6 text-justify text-lg">
            Under certain circumstances, the Company may be required to disclose your Personal Data if required to do so by law or in response to valid requests by public authorities (e.g. a court or a government agency).
          </p>

          <h3 className="text-xl font-display mt-6 mb-3">Other legal requirements</h3>
          <p className="mb-4 text-justify text-lg">
            The Company may disclose your Personal Data in the good faith belief that such action is necessary to:
          </p>
          <ul className="list-disc ml-6 mb-8 space-y-1 text-lg">
            <li>Comply with a legal obligation</li>
            <li>Protect and defend the rights or property of the Company</li>
            <li>Prevent or investigate possible wrongdoing in connection with the Service</li>
            <li>Protect the personal safety of Users of the Service or the public</li>
            <li>Protect against legal liability</li>
          </ul>

          {/* Security of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">Security of Your Personal Data</h2>
          <p className="mb-8 text-justify text-lg">
            The security of your Personal Data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your data, we cannot guarantee its absolute security.
          </p>

          {/* Links to Other Websites */}
          <h2 className="text-3xl font-display mt-12 mb-4">Links to Other Websites</h2>
          <p className="mb-4 text-justify text-lg">
            Our Service may contain links to other websites that are not operated by us. If you click on a third party link, you will be directed to that third party&apos;s site. We strongly advise you to review the Privacy Policy of every site you visit.
          </p>
          <p className="mb-8 text-justify text-lg">
            We have no control over and assume no responsibility for the content, privacy policies or practices of any third party sites or services.
          </p>

          {/* Changes to this Privacy Policy */}
          <h2 className="text-3xl font-display mt-12 mb-4">Changes to this Privacy Policy</h2>
          <p className="mb-4 text-justify text-lg">
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
          </p>
          <p className="mb-4 text-justify text-lg">
            We will let you know via email and/or a prominent notice on our service, prior to the change becoming effective and update the &quot;Last updated&quot; date at the top of this Privacy Policy.
          </p>
          <p className="mb-8 text-justify text-lg">
            You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.
          </p>

          {/* Contact */}
          <h2 className="text-3xl font-display mt-12 mb-4">Contact</h2>
          <p className="mb-8 text-justify text-lg">
            If you have questions about this Privacy Policy, you can contact us via email on <Link target="_blank" className={underlineLinkStyle} href="mailto:hello@measure.sh">hello@measure.sh</Link>
          </p>
        </div>

        <div className="py-8" />
        <Link
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get To The Root Cause
        </Link>
        <div className="py-16" />
      </div>
      <LandingFooter />
    </main >
  )
}
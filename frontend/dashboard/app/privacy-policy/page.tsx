import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "../components/button_variants";
import LandingFooter from "../components/landing_footer";
import LandingHeader from "../components/landing_header";
import TrackCtaLink from "../components/analytics/track_cta_link";
import JsonLd from "../components/json_ld";
import { webPageJsonLd } from "../utils/json_ld";
import { pageMetadata } from "../utils/metadata";
import { cn } from "../utils/shadcn_utils";
import { underlineLinkStyle } from "../utils/shared_styles";

const seo = {
  title: "Privacy Policy",
  description:
    "What Measure does with your data, how we collect it and how we store it. Open source so you can audit it yourself.",
  path: "/privacy-policy",
};

export const metadata: Metadata = pageMetadata(seo);

export default function PrivacyPolicy() {
  return (
    <main className="flex flex-col items-center justify-between">
      <JsonLd data={webPageJsonLd(seo)} />
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        {/* Main description */}
        <div className="py-16" />
        <div className="max-w-6xl mx-auto px-4 py-8 font-body">
          {/* Header */}
          <h1 className="text-5xl font-display mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            Last Updated: Aug 17, 2026
          </p>

          {/* Introduction */}
          <p className="mb-4 text-justify text-lg">
            Measure Inc. (and/or its affiliates) (&ldquo;
            <strong>Company</strong>
            &rdquo; or &ldquo;<strong>We</strong>&rdquo; or &ldquo;
            <strong>Us</strong>&rdquo; or &ldquo;
            <strong>Our</strong>&rdquo; and their connotations) respects Your
            privacy and We are committed to protecting it through this Privacy
            Policy and Our compliance with all applicable laws and regulations.
          </p>
          <p className="mb-4 text-justify text-lg">
            This Privacy Policy describes Our policies and procedures on the
            collection, use and disclosure of Your information when You use the
            Service and tells You about Your privacy rights and how the law
            protects You. We use Your Personal data to provide and improve the
            Service. By using the Service, You agree to the collection and use
            of information in accordance with this Privacy Policy. For any
            requests or inquiries in relation to this Privacy Policy, please see
            the Contact Us section below.
          </p>
          <p className="mb-4 text-justify text-lg">
            The information on this page applies to the Personal Information We
            collect about Your interactions, use, and experience with Our
            website at{" "}
            <Link
              target="_blank"
              className={underlineLinkStyle}
              href="https://measure.sh"
            >
              https://measure.sh
            </Link>{" "}
            (our &ldquo;<strong>Website</strong>&rdquo;), Our mobile SDKs on iOS
            or Android (our &ldquo;<strong>SDK</strong>&rdquo; and together with
            Website, hereinafter referred to as &ldquo;
            <strong>Platform</strong>&rdquo;).
          </p>
          <h2 className="text-3xl font-display mt-12 mb-4">Scope</h2>
          <p className="mb-4 text-justify text-lg">
            This Privacy Policy covers our treatment of personal data
            (&ldquo;Personal Data&rdquo;) that we gather when you access or
            otherwise use the Service. It explains what data we collect, why we
            collect the data, how it is used and your rights and choices. While
            providing our Service, we may collect information about our
            customers&apos; end-users at the direction of and on behalf of our
            customers. Our use of this information is governed by our agreement
            with the applicable customer and the customers&apos; privacy
            policies. We do not control and are not responsible for the privacy
            policies or privacy practices of our customers or any other third
            parties. We encourage you to review any such policies or practices
            that apply to you carefully.
          </p>

          {/* Interpretation and Definitions */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Interpretation and Definitions
          </h2>

          <h3 className="text-2xl font-display mt-6 mb-3">Interpretation</h3>
          <p className="mb-6 text-justify text-lg">
            The words of which the initial letter is capitalized have meanings
            defined under the following conditions. The following definitions
            shall have the same meaning regardless of whether they appear in
            singular or in plural.
          </p>

          <h3 className="text-2xl font-display mt-6 mb-3">Definitions</h3>
          <p className="mb-4 text-justify text-lg">
            For the purposes of this Privacy Policy:
          </p>

          <dl className="mb-8 space-y-4 text-lg">
            <div>
              <dt className="font-semibold">Account</dt>
              <dd className="mt-1 text-justify">
                means a unique account created for you to access our Service or
                parts of our Service.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Affiliate</dt>
              <dd className="mt-1 text-justify">
                means an entity that controls, is controlled by or is under
                common control with a party, where &ldquo;control&rdquo; means
                ownership of 50% or more of the shares, equity interest or other
                securities entitled to vote for election of directors or other
                managing authority.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Company</dt>
              <dd className="mt-1 text-justify">
                (referred to as &ldquo;the Company&rdquo;,
                &ldquo;We&rdquo;,&ldquo;we&rdquo;, &ldquo;Us&rdquo;,
                &ldquo;us&rdquo;, &ldquo;Our&rdquo; or &ldquo;our&rdquo; in this
                Agreement) refers to Measure Inc., 8 The Green, Ste A, Dover, DE
                19901.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Cookies</dt>
              <dd className="mt-1 text-justify">
                are small files that are placed on your computer, mobile device
                or any other device by a website, containing the details of your
                browsing history on that website among its many uses.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Country</dt>
              <dd className="mt-1 text-justify">
                refers to: Delaware, United States
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Device</dt>
              <dd className="mt-1 text-justify">
                means any device that can access the Service such as a computer,
                a cellphone or a digital tablet.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Personal Data</dt>
              <dd className="mt-1 text-justify">
                is any information that relates to an identified or identifiable
                individual in connection with your account and use of our
                Service. This includes information such as your name, email
                address and payment information.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Service</dt>
              <dd className="mt-1 text-justify">
                refers to the Website and the software application provided by
                the Company.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Service Provider</dt>
              <dd className="mt-1 text-justify">
                means any natural or legal person who processes the data on
                behalf of the Company. It refers to third-party companies or
                individuals employed by the Company to facilitate the Service,
                to provide the Service on behalf of the Company, to perform
                services related to the Service or to assist the Company in
                analyzing how the Service is used.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Usage Data</dt>
              <dd className="mt-1 text-justify">
                refers to data collected automatically, either generated by the
                use of the Service or from the Service infrastructure itself
                (for example, the duration of a page visit).
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Website</dt>
              <dd className="mt-1 text-justify">
                refers to measure.sh, accessible from{" "}
                <Link
                  target="_blank"
                  className={underlineLinkStyle}
                  href="https://measure.sh"
                >
                  https://measure.sh
                </Link>
              </dd>
            </div>

            <div>
              <dt className="font-semibold">You/Your</dt>
              <dd className="mt-1 text-justify">
                (referred to as &ldquo;You&rdquo;, &ldquo;you&rdquo;,
                &ldquo;Your&rdquo; or &ldquo;your&rdquo; in this Agreement) is
                the individual accessing or using the Service, or the company or
                other legal entity on behalf of which such individual is
                accessing or using the Service, as applicable.
              </dd>
            </div>
          </dl>

          {/* Types of Data Collected */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Types of Data Collected
          </h2>
          <p className="mb-6 text-justify text-lg">
            We collect and process two distinct categories of data when you use
            our Service: Personal Data about you as a user, and Monitoring Data
            that you send to our platform for monitoring purposes. These are
            separate categories with different purposes, uses and retention
            policies.
          </p>

          <h3 className="text-2xl font-display mt-6 mb-3">Personal Data</h3>
          <p className="mb-4 text-justify text-lg">
            While using our Service, we may ask you to provide us with certain
            personally identifiable information that can be used to contact or
            identify you and manage your account. Personally identifiable
            information may include, but is not limited to:
          </p>
          <ul className="list-disc ml-6 mb-6 space-y-1 text-lg">
            <li>Email address</li>
            <li>First name and last name</li>
            <li>
              Payment Information - If you purchase a subscription, we collect
              data necessary to process your payment. We do not store full
              credit card numbers; these are processed by our third-party
              payment processors.
            </li>
          </ul>

          <h3 className="text-2xl font-display mt-6 mb-3">Usage Data</h3>
          <p className="mb-4 text-justify text-lg">
            Usage Data is collected automatically when using the Service.
          </p>
          <p className="mb-4 text-justify text-lg">
            Usage Data may include information such as your Device&apos;s
            Internet Protocol address (e.g. IP address), browser type, browser
            version, the pages of our Service that you visit, the time and date
            of your visit, the time spent on those pages, unique device
            identifiers and other diagnostic data.
          </p>
          <p className="mb-4 text-justify text-lg">
            When you access the Service by or through a mobile device, we may
            collect certain information automatically, including, but not
            limited to, the type of mobile device you use, your mobile device
            unique ID, the IP address of your mobile device, your mobile
            operating system, the type of mobile Internet browser you use,
            unique device identifiers and other diagnostic data.
          </p>
          <p className="mb-8 text-justify text-lg">
            We may also collect information that your browser sends whenever you
            visit our Service or when you access the Service by or through a
            mobile device. We DO NOT sell this data to any third parties.
          </p>

          {/* Tracking Technologies and Cookies */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Tracking Technologies and Cookies
          </h2>
          <p className="mb-4 text-justify text-lg">
            We use Cookies and similar tracking technologies to track the
            activity on our Service and store certain information. Tracking
            technologies used are beacons, tags and scripts to collect and track
            information and to improve and analyze our Service. The technologies
            we use may include:
          </p>

          <ul className="list-disc ml-6 mb-6 space-y-3 text-lg">
            <li className="text-justify">
              <strong>Cookies or Browser Cookies.</strong> A cookie is a small
              file placed on your Device. You can instruct your browser to
              refuse all Cookies or to indicate when a Cookie is being sent.
              However, if you do not accept Cookies, you may not be able to use
              some parts of our Service. Unless you have adjusted your browser
              setting so that it will refuse Cookies, our Service may use
              Cookies.
            </li>
            <li className="text-justify">
              <strong>Web Beacons.</strong> Certain sections of our Service and
              our emails may contain small electronic files known as web beacons
              (also referred to as clear gifs, pixel tags and single-pixel gifs)
              that permit the Company, for example, to count users who have
              visited those pages or opened an email and for other related
              website statistics (for example, recording the popularity of a
              certain section and verifying system and server integrity).
            </li>
          </ul>

          <p className="mb-4 text-justify text-lg">
            The Cookies we use fall into the following categories:
          </p>

          <div className="mb-6 space-y-4 text-lg">
            <div>
              <h4 className="font-semibold mb-2">
                Necessary / Essential Cookies
              </h4>
              <p className="text-justify">
                These Cookies are essential to provide you with services
                available through the Website and to enable you to use some of
                its features. They help to authenticate users and prevent
                fraudulent use of user accounts. Without these Cookies, the
                services that you have asked for cannot be provided, and we only
                use these Cookies to provide you with those services.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Analytics Cookies</h4>
              <p className="text-justify">
                These Cookies help us understand how visitors use the Website —
                which pages are visited and how the product is used — so that we
                can improve it. They are only set if you accept analytics
                cookies.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Marketing Cookies</h4>
              <p className="text-justify">
                These Cookies support our advertising. They let us measure how
                our advertising campaigns perform and reach people who have
                shown interest in Measure. They are only set if you accept
                marketing cookies.
              </p>
            </div>
          </div>

          <p className="mb-4 text-justify text-lg">
            Analytics and Marketing Cookies are only set after you give consent
            through our cookie banner. Before you make a choice, and if you
            decline, our analytics provider runs in a cookieless mode: it stores
            nothing on your device, does not record your session, and counts
            visits using a temporary identifier that cannot be linked back to
            you. You can review or withdraw your consent at any time using the
            &ldquo;Cookie Preferences&rdquo; link in the Website footer. We use
            a third-party consent management platform to display the cookie
            banner and to store a record of your consent choices.
          </p>

          {/* Use of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Use of Your Personal Data
          </h2>
          <p className="mb-4 text-justify text-lg">
            The Company may use Personal Data for the following purposes:
          </p>

          <ul className="list-disc ml-6 mb-6 space-y-3 text-lg">
            <li className="text-justify">
              <strong>To provide and maintain our Service,</strong> including to
              monitor the usage of our Service.
            </li>
            <li className="text-justify">
              <strong>To manage your Account:</strong> to manage your
              registration as a user of the Service. The Personal Data you
              provide can give you access to different functionalities of the
              Service that are available to you as a registered user.
            </li>
            <li className="text-justify">
              <strong>For the performance of a contract:</strong> the
              development, compliance and undertaking of the purchase contract
              for the products, items or services you have purchased or of any
              other contract with us through the Service.
            </li>
            <li className="text-justify">
              <strong>To contact you:</strong> To contact you by email,
              telephone calls, SMS or other equivalent forms of electronic
              communication, such as a mobile application&apos;s push
              notifications regarding updates or informative communications
              related to the functionalities, products or contracted services,
              including the security updates, when necessary or reasonable for
              their implementation.
            </li>
            <li className="text-justify">
              <strong>To provide you</strong> with news, special offers and
              general information about other goods, services and events which
              we offer that are similar to those that you have already purchased
              or enquired about unless you have opted not to receive such
              information.
            </li>
            <li className="text-justify">
              <strong>To manage your requests:</strong> To attend and manage
              your requests to us.
            </li>
            <li className="text-justify">
              <strong>For business transfers:</strong> We may use your
              information to evaluate or conduct a merger, divestiture,
              restructuring, reorganization, dissolution or other sale or
              transfer of some or all of our assets, whether as a going concern
              or as part of bankruptcy, liquidation or similar proceeding, in
              which Personal Data held by us about our Service users is among
              the assets transferred.
            </li>
            <li className="text-justify">
              <strong>For other purposes:</strong> We may use your information
              for other purposes, such as data analysis, identifying usage
              trends, determining the effectiveness of our promotional campaigns
              and to evaluate and improve our Service, products, services,
              marketing and your experience.
            </li>
          </ul>

          <p className="mb-4 text-justify text-lg">
            We may share your personal information in the following situations:
          </p>

          <ul className="list-disc ml-6 mb-8 space-y-3 text-lg">
            <li className="text-justify">
              <strong>With Service Providers:</strong> We may share your
              personal account information with Service Providers to monitor and
              analyze the use of our Service, to contact you and to process
              payments.
            </li>
            <li className="text-justify">
              <strong>For business transfers:</strong> We may share or transfer
              your personal information in connection with, or during
              negotiations of, any merger, sale of Company assets, financing, or
              acquisition of all or a portion of our business to another
              company.
            </li>
            <li className="text-justify">
              <strong>With Affiliates:</strong> We may share your information
              with our affiliates, in which case we will require those
              affiliates to honor this Privacy Policy. Affiliates include our
              parent company and any other subsidiaries, joint venture partners
              or other companies that we control or that are under common
              control with us.
            </li>
            <li className="text-justify">
              <strong>With business partners:</strong> We may share your account
              information with our business partners to offer you certain
              products, services or promotions.
            </li>
            <li className="text-justify">
              <strong>With other users:</strong> When you share personal
              information or otherwise interact in public areas with other
              users, such information may be viewed by all users and may be
              publicly distributed outside.
            </li>
            <li className="text-justify">
              <strong>With Your consent:</strong> We may disclose your personal
              information for any other purpose with your consent.
            </li>
          </ul>

          {/* Retention of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Retention of Your Personal Data
          </h2>
          <p className="mb-4 text-justify text-lg">
            The Company will retain your Personal Data (such as your name, email
            address, account information and payment details—but NOT your
            Monitoring Data) only for as long as is necessary for the purposes
            set out in this Privacy Policy. Specifically:
          </p>
          <ul className="list-disc ml-6 mb-6 space-y-2 text-lg">
            <li className="text-justify">
              While your account is active, we retain your Personal Data to
              provide you with the Service and manage your account.
            </li>
            <li className="text-justify">
              After account closure or subscription termination, we will retain
              your Personal Data to the extent necessary to comply with our
              legal obligations (for example, if we are required to retain your
              data to comply with applicable laws, tax regulations, or
              accounting requirements), resolve disputes, enforce our legal
              agreements and policies and prevent fraud.
            </li>
            <li className="text-justify">
              We will also retain Usage Data for internal analysis purposes.
              Usage Data is generally retained for a shorter period of time,
              except when this data is used to strengthen the security or to
              improve the functionality of our Service, or we are legally
              obligated to retain this data for longer time periods.
            </li>
          </ul>
          <p className="mb-6 text-justify text-lg">
            By way of indicative retention periods: (a) account and profile data
            are retained for the duration of your account and for up to 90
            (ninety) days after account closure, after which they are deleted or
            anonymised, unless a longer period is required by law; (b) billing
            and transaction records are retained for up to 7 (seven) years to
            meet tax and accounting obligations; (c) Usage Data is retained for
            up to 24 (twenty four) months, save where retained longer for
            security or legal reasons; and (d) records of cookie consent are
            retained for up to 12 (twelve) months. Monitoring Data is retained
            in accordance with the applicable customer configuration and
            agreement, and not under this Privacy Policy.
          </p>

          {/* Transfers of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Transfers of Your Personal Data
          </h2>
          <p className="mb-4 text-justify text-lg">
            Your information, including Personal Data, is processed at the
            Company&apos;s operating offices and in any other places where the
            parties involved in the processing are located. It means that this
            information may be transferred to and maintained on computers
            located outside of your state, province, country or other
            governmental jurisdiction where the data protection laws may differ
            than those from your jurisdiction.
          </p>
          <p className="mb-4 text-justify text-lg">
            Your consent to this Privacy Policy followed by your submission of
            such information represents your agreement to that transfer.
          </p>
          <p className="mb-4 text-justify text-lg">
            In the event We transfer Your Personal Information to countries
            outside the European Economic Area, We endeavour to put in place
            necessary safeguards to ensure that the said data transfer shall
            comply with the applicable laws and regulations. If You are a
            resident of the European Union and/or subject to the European
            General Data Protection Regulation (Regulation (EU) 2016/679),
            please reach out to Us at Our contact details below with the
            specifics of Your request/s, and We will ensure that Your data
            collected, stored, and/or used by Us (if any) and their privacy are
            protected in accordance with the laws and regulations applicable in
            Your jurisdiction. We would like to make sure that You are fully
            aware of Your data protection rights, which may include the right to
            access, rectification, erasure, restrict or object to processing,
            data portability, etc. If You make a request under this head, We
            will endeavour to respond within 45 days.
          </p>
          <p className="mb-8 text-justify text-lg">
            The Company will take all steps reasonably necessary to ensure that
            your Personal Data is treated securely and in accordance with this
            Privacy Policy and no transfer of your data will take place to an
            organization or a country unless there are adequate controls in
            place including the security of your data and other information.
          </p>

          {/* Deletion of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Deletion of Your Personal Data
          </h2>
          <p className="mb-4 text-justify text-lg">
            You have the right to delete or request that we assist in deleting
            the Personal Data (account information, contact details, payment
            information) that we have collected about you.
          </p>
          <p className="mb-4 text-justify text-lg">
            Our Service may give you the ability to delete certain information
            about you from within the Service.
          </p>
          <p className="mb-4 text-justify text-lg">
            You may update, amend or delete your Personal Data at any time by
            signing in to your Account, if you have one, and visiting the
            account settings section that allows you to manage your personal
            information. You may also contact us to request access to, correct
            or delete any Personal Data that you have provided to us.
          </p>
          <p className="mb-6 text-justify text-lg">
            Please note, however, that we may need to retain certain Personal
            Data when we have a legal obligation or lawful basis to do so.
          </p>

          {/* Controller and processor roles */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Controller and processor roles
          </h2>
          <p className="mb-4 text-justify text-lg">
            For Personal Data relating to your account, billing and use of the
            Service, Measure acts as a controller under the GDPR and UK GDPR,
            and as a business under US state privacy laws, and determines the
            purposes and means of processing.
          </p>
          <p className="mb-8 text-justify text-lg">
            For Monitoring Data, and any personal data contained in it, that our
            customers send to the platform, Measure acts as a processor under
            the GDPR and UK GDPR, and as a service provider or processor under
            US state privacy laws, and processes such data on behalf of, and on
            the documented instructions of, the applicable customer, who is the
            controller or business.
          </p>

          {/* Children's privacy */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Children&rsquo;s privacy
          </h2>
          <p className="mb-8 text-justify text-lg">
            The Service is intended for users aged 18 and over. We do not
            knowingly collect Personal Data from children. If you believe a
            child has provided us with Personal Data, please contact us and we
            will take steps to delete it.
          </p>

          {/* Disclosure of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Disclosure of Your Personal Data
          </h2>
          <h3 className="text-xl font-display mt-6 mb-3">
            Business Transactions
          </h3>
          <p className="mb-6 text-justify text-lg">
            If the Company is involved in a merger, acquisition or asset sale,
            your Personal Data may be transferred. We will provide notice before
            your data is transferred and becomes subject to a different Privacy
            Policy.
          </p>

          <h3 className="text-xl font-display mt-6 mb-3">Law enforcement</h3>
          <p className="mb-6 text-justify text-lg">
            Under certain circumstances, the Company may be required to disclose
            your Personal Data if required to do so by law or in response to
            valid requests by public authorities (e.g. a court or a government
            agency).
          </p>

          <h3 className="text-xl font-display mt-6 mb-3">
            Other legal requirements
          </h3>
          <p className="mb-4 text-justify text-lg">
            The Company may disclose your Personal Data in the good faith belief
            that such action is necessary to:
          </p>
          <ul className="list-disc ml-6 mb-8 space-y-1 text-lg">
            <li>Comply with a legal obligation</li>
            <li>Protect and defend the rights or property of the Company</li>
            <li>
              Prevent or investigate possible wrongdoing in connection with the
              Service
            </li>
            <li>
              Protect the personal safety of Users of the Service or the public
            </li>
            <li>Protect against legal liability</li>
          </ul>

          {/* Security of Your Personal Data */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Security of Your Personal Data
          </h2>
          <p className="mb-8 text-justify text-lg">
            The security of your Personal Data is important to us, but remember
            that no method of transmission over the Internet, or method of
            electronic storage is 100% secure. While we strive to use
            commercially acceptable means to protect your data, we cannot
            guarantee its absolute security.
          </p>

          {/* Links to Other Websites */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Links to Other Websites
          </h2>
          <p className="mb-8 text-justify text-lg">
            The Platform may contain links to other websites. Please note that
            when Users click on one of these links, they are entering another
            website over which We have no control and for which We will bear no
            responsibility. Often these websites require the User to enter their
            Personal Information. We encourage and recommend the Users to read
            the privacy policies of all such websites as their policies may
            differ from Our Privacy Policy. Users agree that We shall not be
            liable for any breach of Your privacy of Personal Information or
            loss incurred by their use of such websites or services. The
            inclusions or exclusions are not suggestive of any endorsement by
            the Company of the website or contents of the website. The Users may
            visit any third-party website linked to the Platform at their risk.
          </p>

          {/* What are Your Rights? */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            What are Your Rights?
          </h2>
          <p className="mb-4 text-justify text-lg">
            As a User, the Company grants You complete control of the
            information submitted by You. The rights pertaining thereto are
            enumerated below:
          </p>
          <ul className="list-disc ml-6 mb-6 space-y-3 text-lg">
            <li className="text-justify">
              <strong>
                The right to access the information We have on the User.
              </strong>{" "}
              You have a right to request that We provide You with a copy of
              Your Personal Information that We hold, and You have the right to
              be informed of: (a) a summary of your Personal Information which
              is being processed by us; (b) the processing activities undertaken
              by us with respect to your Personal Information; (c) the data
              controller&rsquo;s identity (i.e., information about persons who
              control the manner in which Your Personal Information is
              processed); and (d) the entities or categories of entities to whom
              Your Personal Information may be transferred.
            </li>
            <li className="text-justify">
              <strong>The right of rectification.</strong> You have a right to
              rectify in the profile section of the Platform or request that We
              rectify inaccurate Personal Information, complete the incomplete
              Personal Information or update the Personal Information. We may
              seek to verify the accuracy of the Personal Information before
              rectifying it.
            </li>
            <li className="text-justify">
              <strong>The right to erasure.</strong> You can also request that
              We erase Your Personal Information in limited circumstances where:
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>
                  it is no longer needed for the purposes for which it was
                  collected; or
                </li>
                <li>
                  You have withdrawn Your consent (where the data processing was
                  based on consent); or
                </li>
                <li>
                  following a successful right to object (see right to object);
                  or
                </li>
                <li>it has been processed unlawfully; or</li>
                <li>to comply with any legal obligations of the Company.</li>
              </ul>
              <p className="mt-2">
                We are not required to comply with Your request to erase
                Personal Information if the processing of Your Personal
                Information is necessary (a) for compliance with a legal
                obligation; (b) or for the establishment, exercise or defence of
                legal claims.
              </p>
            </li>
            <li className="text-justify">
              <strong>The right to withdraw consent.</strong> Users have the
              right to withdraw their consent at any time, when consent is given
              pertaining to Personal Information.
            </li>
            <li className="text-justify">
              <strong>
                The right to lodge a complaint with the local supervisory
                authority.
              </strong>{" "}
              You have a right to lodge a complaint with the Data Protection
              Board of India if You have concerns about how We are processing
              Your Personal Information. We ask that You please attempt to
              resolve any issues with Us first, although You have a right to
              contact Your supervisory authority at any time.
            </li>
            <li className="text-justify">
              <strong>The right to be informed.</strong> Users have the right to
              be informed about third parties with which their Personal
              Information has been shared.
            </li>
            <li className="text-justify">
              <strong>The right to unsubscribe.</strong> You may always opt-out
              of receiving future e-mail messages and newsletters from the
              Company. We provide you with the opportunity to opt-out of
              receiving communications from Us by choosing the appropriate
              options for unsubscribing under your emails. To opt-out, you can
              also send us a message at{" "}
              <Link
                target="_blank"
                className={underlineLinkStyle}
                href="mailto:privacy@measure.sh"
              >
                privacy@measure.sh
              </Link>
              . Please note, however, that you generally cannot opt-out of
              service-related announcements, e.g., if the Service is temporarily
              suspended or if delivery of a product or service is delayed.
            </li>
            <li className="text-justify">
              <strong>The right to nominate.</strong> Users shall have the right
              to nominate any other individual, who shall, in the event of death
              or incapacity of such User, exercise the rights provided above.
            </li>
          </ul>
          <p className="mb-4 text-justify text-lg">
            We may ask You for additional information to confirm Your identity
            and for security purposes, before disclosing the Personal
            Information requested to You. We reserve the right to charge a fee,
            where permitted by law, for instance, if Your request is manifestly
            unfounded or excessive. You can exercise Your rights by contacting
            Us at{" "}
            <Link
              target="_blank"
              className={underlineLinkStyle}
              href="mailto:privacy@measure.sh"
            >
              privacy@measure.sh
            </Link>
            . Subject to legal and other permissible considerations, We will
            make every reasonable effort to honour Your request promptly or
            inform You if We require further information in order to fulfil Your
            request.
          </p>
          <p className="mb-8 text-justify text-lg">
            We may not always be able to fully address Your request, for
            example, if it would impact the duty of confidentiality We owe to
            other Users, or if We are legally entitled to deal with the request
            in a different way.
          </p>

          {/* Changes to this Privacy Policy */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Changes to this Privacy Policy
          </h2>
          <p className="mb-4 text-justify text-lg">
            We may update our Privacy Policy from time to time. We will notify
            you of any changes by posting the new Privacy Policy on this page.
          </p>
          <p className="mb-4 text-justify text-lg">
            We will let you know via email and/or a prominent notice on our
            service, prior to the change becoming effective and update the
            &ldquo;Last Updated&rdquo; date at the top of this Privacy Policy.
          </p>
          <p className="mb-8 text-justify text-lg">
            You are advised to review this Privacy Policy periodically for any
            changes. Changes to this Privacy Policy are effective when they are
            posted on this page.
          </p>

          {/* Grievance Officer */}
          <h2 className="text-3xl font-display mt-12 mb-4">
            Grievance Officer
          </h2>
          <p className="mb-4 text-justify text-lg">
            Any complaints, abuse or concerns with regards to content and or
            comment or breach of the terms in this Privacy Policy shall be
            immediately informed to the designated Grievance Officer as
            mentioned below in writing or through email signed with the
            electronic signature:
          </p>
          <h3 className="text-xl font-display mt-6 mb-3">
            EU GDPR representative
          </h3>
          <div className="mb-4 text-lg">
            <p>Rickert Rechtsanwaltsgesellschaft mbH</p>
            <p>- Measure Inc -</p>
            <p>Colmantstraße 15</p>
            <p>53115 Bonn</p>
            <p>Germany</p>
            <p>
              <Link
                target="_blank"
                className={underlineLinkStyle}
                href="mailto:art-27-rep-MeasureInc@rickert.law"
              >
                art-27-rep-MeasureInc@rickert.law
              </Link>
            </p>
          </div>
          <h3 className="text-xl font-display mt-6 mb-3">
            UK GDPR representative
          </h3>
          <div className="mb-4 text-lg">
            <p>Rickert Services Ltd UK</p>
            <p>- Measure Inc -</p>
            <p>PO Box 1487</p>
            <p>Peterborough</p>
            <p>PE1 9XX</p>
            <p>United Kingdom</p>
            <p>
              <Link
                target="_blank"
                className={underlineLinkStyle}
                href="mailto:art-27-rep-MeasureInc@rickert-services.uk"
              >
                art-27-rep-MeasureInc@rickert-services.uk
              </Link>
            </p>
          </div>
          <p className="mb-8 text-justify text-lg">
            Your use of the Platform and any dispute over privacy is subject to
            this Privacy Policy and Terms.
          </p>

          {/* Contact */}
          <h2 className="text-3xl font-display mt-12 mb-4">Contact</h2>
          <p className="mb-8 text-justify text-lg">
            If you have questions about this Privacy Policy, you can contact us
            via email on{" "}
            <Link
              target="_blank"
              className={underlineLinkStyle}
              href="mailto:privacy@measure.sh"
            >
              privacy@measure.sh
            </Link>
          </p>
        </div>

        <div className="py-8" />
        <TrackCtaLink
          location="privacy_policy"
          destination="signup"
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "text-2xl px-8 py-8",
          )}
        >
          Get Started For Free
        </TrackCtaLink>
        <div className="py-16" />
      </div>
      <LandingFooter />
    </main>
  );
}

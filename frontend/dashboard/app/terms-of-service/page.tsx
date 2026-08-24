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
  title: "Terms of Service",
  description:
    "Terms of Service for Measure Cloud and the open source Measure project.",
  path: "/terms-of-service",
};

export const metadata: Metadata = pageMetadata(seo);

export default function TermsOfService() {
  return (
    <main className="flex flex-col items-center justify-between">
      <JsonLd data={webPageJsonLd(seo)} />
      <LandingHeader />
      <div className="flex flex-col items-center w-full">
        <div className="max-w-6xl mx-auto px-4 py-8 font-body">
          {/* Header */}
          <div className="py-16" />
          <h1 className="text-6xl font-display mb-2">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">
            Last Updated: Aug 17, 2026
          </p>
          <h2 className="text-3xl font-display mt-8 mb-4">Measure Cloud</h2>
          <p className="mb-4 text-justify text-lg">
            PLEASE READ THESE TERMS OF USE CAREFULLY. BY SIGNING UP TO AND/OR
            USING THIS PLATFORM AND OUR SERVICES, YOU AGREE TO BE BOUND BY ALL
            OF THE BELOW TERMS AND CONDITIONS AND PRIVACY POLICY.
          </p>
          <p className="mb-4 text-justify text-lg">
            Measure Inc. (&ldquo;Company&rdquo;, &ldquo;We&rdquo; or
            &ldquo;Us&rdquo; and their connotations) owns and operates Our
            website at{" "}
            <Link
              target="_blank"
              className={underlineLinkStyle}
              href="https://measure.sh"
            >
              https://measure.sh
            </Link>{" "}
            (&ldquo;Website&rdquo;) and Our mobile SDK on iOS or Android called
            (&ldquo;SDK&rdquo;). The Website and the SDK are together called as
            &ldquo;Platform&rdquo;.
          </p>
          <p className="mb-4 text-justify text-lg">
            These terms of use (&ldquo;Terms&rdquo;) describe the terms on which
            the Company grants Users (defined below) access to the Platform and
            shall be read with the privacy policy available{" "}
            <Link className={underlineLinkStyle} href="/privacy-policy">
              here
            </Link>{" "}
            (&ldquo;Privacy Policy&rdquo;). The users of the Platform are herein
            referred to as &ldquo;You&rdquo;, &ldquo;Your&rdquo; or
            &ldquo;User(s)&rdquo;.
          </p>
          <p className="mb-8 text-justify text-lg">
            These Terms along with the Privacy Policy constitute the entire
            agreement between the Company and You with respect to Your use of
            the Platform and/or the Services (defined below).
          </p>

          {/* Definitions and Interpretation */}
          <h3 className="text-2xl font-display mt-8 mb-4">
            Definitions and Interpretation
          </h3>

          <h4 className="text-xl font-display mt-6 mb-3">1.1. Definitions</h4>
          <p className="mb-4 text-justify text-lg">
            For the purposes of these Terms of Service:
          </p>

          <dl className="mb-8 space-y-4 text-lg">
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
              <dt className="font-semibold">Account</dt>
              <dd className="mt-1 text-justify">
                means a unique account created for you to access our Service or
                parts of our Service.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Country</dt>
              <dd className="mt-1 text-justify">
                refers to: Delaware, United States
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
              <dt className="font-semibold">Device</dt>
              <dd className="mt-1 text-justify">
                means any device that can access the Service such as a computer,
                a cellphone or a digital tablet.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Feedback</dt>
              <dd className="mt-1 text-justify">
                means feedback, innovations or suggestions sent by you regarding
                the attributes, performance or features of our Service.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Free Trial</dt>
              <dd className="mt-1 text-justify">
                refers to a limited period of time or usage volume that may be
                free when purchasing a Subscription.
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
              <dt className="font-semibold">Subscriptions</dt>
              <dd className="mt-1 text-justify">
                refer to the services or access to the Service offered on a
                subscription basis by the Company to you.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Terms of Service</dt>
              <dd className="mt-1 text-justify">
                (also referred as &ldquo;Terms&rdquo;) mean these Terms of
                Service that form the entire agreement between you and the
                Company regarding the use of the Service.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">
                Third-party Social Media Service
              </dt>
              <dd className="mt-1 text-justify">
                means any services or content (including data, information,
                products or services) provided by a third-party that may be
                displayed, included or made available by the Service.
              </dd>
            </div>

            <div>
              <dt className="font-semibold">Website</dt>
              <dd className="mt-1 text-justify">
                refers to measure.sh, accessible from{" "}
                <Link className={underlineLinkStyle} href="https://measure.sh">
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

          <h4 className="text-xl font-display mt-6 mb-3">
            1.2. Interpretation
          </h4>
          <p className="mb-4 text-justify text-lg">
            In this Agreement, unless the context requires otherwise:
          </p>
          <ul className="list-disc ml-6 mb-8 space-y-3 text-lg">
            <li className="text-justify">
              the headings are inserted for ease of reference only and shall not
              affect the construction or interpretation of this Agreement;
            </li>
            <li className="text-justify">
              references to one gender include all genders;
            </li>
            <li className="text-justify">
              any reference to any Law is a reference to it as it may have been,
              or may from time to time be, amended, modified, consolidated or
              re-enacted (with or without modification);
            </li>
          </ul>

          {/* Acknowledgment */}
          <h3 className="text-2xl font-display mt-12 mb-4">Acknowledgment</h3>
          <p className="mb-4 text-justify text-lg">
            These are the Terms of Service governing the use of this Service and
            the agreement that operates between you and the Company. These Terms
            of Service set out the rights and obligations of all users regarding
            the use of the Service.
          </p>
          <p className="mb-4 text-justify text-lg">
            Your access to and use of the Service is conditioned on your
            acceptance of and compliance with these Terms of Service. These
            Terms of Service apply to all visitors, users and others who access
            or use the Service.
          </p>
          <p className="mb-4 text-justify text-lg">
            By accessing or using the Service you agree to be bound by these
            Terms of Service. If you disagree with any part of these Terms of
            Service then you may not access the Service.
          </p>
          <p className="mb-4 text-justify text-lg">
            You represent that you are over the age of 18. The Company does not
            permit those under 18 to use the Service.
          </p>
          <p className="mb-8 text-justify text-lg">
            Your access to and use of the Service is also conditioned on your
            acceptance of and compliance with the Privacy Policy of the Company.
            Our Privacy Policy describes our policies and procedures on the
            collection, use and disclosure of your personal information when you
            use the Application or the Website and tells you about your privacy
            rights and how the law protects you. Please read our Privacy Policy
            carefully before using our Service.
          </p>

          {/* Subscriptions */}
          <h3 className="text-2xl font-display mt-8 mb-4">Subscriptions</h3>

          <h4 className="text-xl font-display mt-6 mb-3">
            Subscription period
          </h4>
          <p className="mb-4 text-justify text-lg">
            The Service or some parts of the Service are available only with a
            paid Subscription. You will be billed in advance on a recurring and
            periodic basis (such as monthly or annually), depending on the type
            of Subscription plan you select when purchasing the Subscription.
            Any usage or overage fees incurred beyond the limits of your
            selected plan will be billed in arrears at the end of each billing
            cycle.
          </p>
          <p className="mb-6 text-justify text-lg">
            At the end of each period, your Subscription will automatically
            renew under the exact same conditions unless you cancel it or the
            Company cancels it. Upon cancellation, you remain responsible for
            any accrued usage or overage fees incurred up to the effective date
            of cancellation.
          </p>

          <h4 className="text-xl font-display mt-6 mb-3">
            Subscription cancellations
          </h4>
          <p className="mb-6 text-justify text-lg">
            You may cancel your Subscription renewal either through your Account
            settings page or by contacting the Company. You will not receive a
            refund for the fees you already paid for your current Subscription
            period and you will be able to access the Service until the end of
            your current Subscription period.
          </p>

          <h4 className="text-xl font-display mt-6 mb-3">Billing</h4>
          <p className="mb-4 text-justify text-lg">
            You shall provide the Company with accurate and complete billing
            information including full name, address, state, zip code, telephone
            number and a valid payment method information. You authorize the
            Company to charge your payment method for both recurring
            subscription fees and any applicable usage or overage fees.
          </p>
          <p className="mb-6 text-justify text-lg">
            Should automatic billing fail to occur for any reason, the Company
            will issue an electronic invoice indicating that you must proceed
            manually, within a certain deadline date, with the full payment
            corresponding to the billing period as indicated on the invoice.
          </p>

          <h4 className="text-xl font-display mt-6 mb-3">Fee Changes</h4>
          <p className="mb-4 text-justify text-lg">
            The Company, in its sole discretion and at any time, may modify the
            Subscription fees or usage rates. Any Subscription fee change will
            become effective at the end of the then-current Subscription period.
          </p>
          <p className="mb-4 text-justify text-lg">
            The Company will provide you with reasonable prior notice of any
            change in Subscription fees or usage rates to give you an
            opportunity to terminate your Subscription before such change
            becomes effective.
          </p>
          <p className="mb-6 text-justify text-lg">
            Your continued use of the Service after the Subscription fee change
            comes into effect constitutes your agreement to pay the modified
            fees.
          </p>

          <h4 className="text-xl font-display mt-6 mb-3">Refunds</h4>
          <p className="mb-4 text-justify text-lg">
            Except when required by law, paid Subscription and usage fees are
            non-refundable.
          </p>
          <p className="mb-6 text-justify text-lg">
            Certain refund requests for Subscriptions may be considered by the
            Company on a case-by-case basis and granted at the sole discretion
            of the Company.
          </p>

          <h4 className="text-xl font-display mt-6 mb-3">Free Trial</h4>
          <p className="mb-4 text-justify text-lg">
            The Company may, at its sole discretion, offer a Subscription with a
            Free Trial for a limited period of time or a limited volume of usage
            or both.
          </p>
          <p className="mb-4 text-justify text-lg">
            You may be required to enter your billing information in order to
            sign up for the Free Trial.
          </p>
          <p className="mb-4 text-justify text-lg">
            If you do enter your billing information when signing up for a Free
            Trial, you will not be charged by the Company until the Free Trial
            has expired or the usage limit is reached. On the last day of the
            Free Trial period or upon reaching the usage limit, unless you
            canceled your Subscription, you will be automatically charged the
            applicable Subscription fees for the type of Subscription you have
            selected.
          </p>
          <p className="mb-8 text-justify text-lg">
            At any time and without notice, the Company reserves the right to
            (i) modify the terms of service of the Free Trial offer, or (ii)
            cancel such Free Trial offer.
          </p>

          {/* User Accounts */}
          <h3 className="text-2xl font-display mt-12 mb-4">User Accounts</h3>
          <p className="mb-4 text-justify text-lg">
            When you create an account with us, you must provide us information
            that is accurate, complete and current at all times. Failure to do
            so constitutes a breach of the Terms, which may result in immediate
            termination of your account on our Service.
          </p>
          <p className="mb-4 text-justify text-lg">
            You are responsible for safeguarding the password that you use to
            access the Service and for any activities or actions under your
            password, whether your password is with our Service or a Third-Party
            Social Media Service.
          </p>
          <p className="mb-4 text-justify text-lg">
            You agree not to disclose your password to any third party. You must
            notify us immediately upon becoming aware of any breach of security
            or unauthorized use of your account.
          </p>
          <p className="mb-8 text-justify text-lg">
            You may not use as a username the name of another person or entity
            or that is not lawfully available for use, a name or trademark that
            is subject to any rights of another person or entity other than you
            without appropriate authorization or a name that is otherwise
            offensive, vulgar or obscene.
          </p>

          {/* Your Feedback to Us */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            Your Feedback to Us
          </h3>
          <p className="mb-8 text-justify text-lg">
            You assign all rights, title and interest in any Feedback you
            provide the Company. If for any reason such assignment is
            ineffective, you agree to grant the Company a non-exclusive,
            perpetual, irrevocable, royalty free, worldwide right and license to
            use, reproduce, disclose, sub-license, distribute, modify and
            exploit such Feedback without restriction.
          </p>

          {/* Links to Other Websites */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            Links to Other Websites
          </h3>
          <p className="mb-4 text-justify text-lg">
            Our Service may contain links to third-party web sites or services
            that are not owned or controlled by the Company.
          </p>
          <p className="mb-4 text-justify text-lg">
            The Company has no control over, and assumes no responsibility for,
            the content, privacy policies or practices of any third party web
            sites or services. You further acknowledge and agree that the
            Company shall not be responsible or liable, directly or indirectly,
            for any damage or loss caused or alleged to be caused by or in
            connection with the use of or reliance on any such content, goods or
            services available on or through any such web sites or services.
          </p>
          <p className="mb-8 text-justify text-lg">
            We strongly advise you to read the terms of service and privacy
            policies of any third-party web sites or services that you visit.
          </p>

          {/* Representations and Warranties */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            Representations and Warranties
          </h3>
          <p className="mb-4 text-justify text-lg">
            Each Party hereby represents and warrants for itself, as at the date
            of the Order Form, to the other Party as follows:
          </p>
          <p className="mb-4 text-justify text-lg">
            <strong>1.1. Organization:</strong> It is duly incorporated and
            validly existing and registered in accordance with the applicable
            laws.
          </p>
          <p className="mb-4 text-justify text-lg">
            <strong>1.2. Authority:</strong> It has full corporate or other
            organizational power and authority to agree to, and to perform its
            obligations under these Terms. The execution, delivery and
            performance of these Terms by it have been duly and validly
            authorized by all necessary corporate action and are not subject to
            encumbrances of any nature.
          </p>
          <p className="mb-4 text-justify text-lg">
            <strong>1.3. Binding Effect:</strong> These Terms constitute legal,
            valid and binding obligations of the Party, enforceable in
            accordance with its terms.
          </p>
          <p className="mb-4 text-justify text-lg">
            <strong>1.4. No Violation:</strong> The execution, delivery and
            performance of these Terms will not (i) violate or conflict with any
            provision of its constitutional documents, (ii) violate or conflict
            with any Applicable Laws or permit, consents or authorizations,
            applicable to the Party, or (iii) constitute a breach of or under
            any contract, agreement, arrangement or judgement to which it is a
            party to.
          </p>
          <p className="mb-4 text-justify text-lg">
            <strong>1.5. No Proceedings:</strong> To the knowledge of the Party,
            except as disclosed in writing, that there is no proceeding,
            inquiry, investigation or litigation by any person, whether pending
            or threatened against the Party that would be reasonably likely to
            result in monetary damages, injunctive relief, or the taking of any
            other action that would be reasonably expected to (in any of the
            foregoing cases) impair the ability of the Party to perform its
            obligations under these Terms.
          </p>
          <p className="mb-8 text-justify text-lg">
            <strong>1.6. Consents:</strong> It is not required to (i) obtain any
            authorization, or waiver, of, (ii) to make any filing or
            registration with, or (iii) give any notice to, any authority in
            connection with or as a condition to the execution, delivery and
            performance of these Terms.
          </p>

          {/* Our Intellectual Property Rights */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            Our Intellectual Property Rights
          </h3>
          <p className="mb-8 text-justify text-lg">
            The User acknowledges that it is obtaining the right to access the
            Platform and use the Services, and that irrespective of any use of
            the words &ldquo;purchase&rdquo;, &ldquo;sale&rdquo; or like terms,
            in no case will any ownership rights be conveyed or be deemed to be
            conveyed to the User under these terms. User agrees that the Company
            or its suppliers retain all rights, title, and interest (including
            all intellectual property rights) in and to the Platform, Services,
            all documentation, services deliverables, and any and all related
            and underlying technology and documentation and any derivative
            works, modifications or improvements of any of the foregoing
            (including but not limited to all texts, graphics, photos,
            illustrations, questionnaire content, logos), including Feedback
            (collectively, &ldquo;Company Technology&rdquo;). You shall not
            copy, download, publish, distribute or reproduce any of the
            information contained on this Platform or social media in any form
            without the prior written consent of the Company. Except as
            expressly set forth in these terms, no rights in any Company
            Technology are granted to the User.
          </p>

          {/* Termination */}
          <h3 className="text-2xl font-display mt-12 mb-4">Termination</h3>
          <p className="mb-4 text-justify text-lg">
            You understand and agree that the Company may remove, restrict,
            cancel or suspend access to and/or use of the Service and any part
            of it if the Company considers (in the sole discretion of Company)
            that You have breached any of these Terms.
          </p>
          <p className="mb-8 text-justify text-lg">
            Please note that if Your access to the Platform and/ or the Services
            has been removed, restricted, cancelled or suspended, We do not have
            an obligation to restore the same unless otherwise required under
            applicable law. If You wish to terminate Your account, You may
            simply discontinue using the Service. If You believe Your access has
            been terminated in error, You may contact Us at{" "}
            <Link
              target="_blank"
              className={underlineLinkStyle}
              href="mailto:privacy@measure.sh"
            >
              privacy@measure.sh
            </Link>
            .
          </p>

          {/* Indemnification */}
          <h3 className="text-2xl font-display mt-12 mb-4">Indemnification</h3>
          <p className="mb-8 text-justify text-lg">
            You hereby indemnify to the fullest extent the Company and its
            officers, directors, employees and agents from and against any
            and/or all liabilities, costs, demands, causes of action, damages
            and expenses arising in any way related to Your breach of any of the
            provisions of these Terms.
          </p>

          {/* Limitation of Liability */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            Limitation of Liability
          </h3>
          <p className="mb-4 text-justify text-lg">
            Notwithstanding any damages that you might incur, the entire
            liability of the Company and any of its suppliers under any
            provision of this Terms and your exclusive remedy for all of the
            foregoing shall be limited to the amount actually paid by you
            through the Service or 100 USD if you haven&apos;t purchased
            anything through the Service.
          </p>
          <p className="mb-4 text-justify text-lg">
            To the maximum extent permitted by applicable law, in no event shall
            the Company or its suppliers be liable for any special, incidental,
            indirect or consequential damages whatsoever (including, but not
            limited to, damages for loss of profits, loss of data or other
            information, for business interruption, for personal injury, loss of
            privacy arising out of or in any way related to the use of or
            inability to use the Service, third-party software and/or
            third-party hardware used with the Service or otherwise in
            connection with any provision of this Terms), even if the Company or
            any supplier has been advised of the possibility of such damages and
            even if the remedy fails of its essential purpose.
          </p>
          <p className="mb-8 text-justify text-lg">
            Some states do not allow the exclusion of implied warranties or
            limitation of liability for incidental or consequential damages,
            which means that some of the above limitations may not apply. In
            these states, each party&apos;s liability will be limited to the
            greatest extent permitted by law.
          </p>

          {/* &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; Disclaimer */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; Disclaimer
          </h3>
          <p className="mb-4 text-justify text-lg">
            The Service is provided to you &ldquo;AS IS&rdquo; and &ldquo;AS
            AVAILABLE&rdquo; and with all faults and defects without warranty of
            any kind. To the maximum extent permitted under applicable law, the
            Company, on its own behalf and on behalf of its Affiliates and its
            and their respective licensors and service providers, expressly
            disclaims all warranties, whether express, implied, statutory or
            otherwise, with respect to the Service, including all implied
            warranties of merchantability, fitness for a particular purpose,
            title and non-infringement and warranties that may arise out of
            course of dealing, course of performance, usage or trade practice.
            Without limitation to the foregoing, the Company provides no
            warranty or undertaking, and makes no representation of any kind
            that the Service will meet your requirements, achieve any intended
            results, be compatible or work with any other software,
            applications, systems or services, operate without interruption,
            meet any performance or reliability standards or be error free or
            that any errors or defects can or will be corrected.
          </p>
          <p className="mb-4 text-justify text-lg">
            Without limiting the foregoing, neither the Company nor any of the
            company&apos;s provider makes any representation or warranty of any
            kind, express or implied: (i) as to the operation or availability of
            the Service, or the information, content and materials or products
            included thereon; (ii) that the Service will be uninterrupted or
            error-free; (iii) as to the accuracy, reliability or currency of any
            information or content provided through the Service; or (iv) that
            the Service, its servers, the content or e-mails sent from or on
            behalf of the Company are free of viruses, scripts, trojan horses,
            worms, malware, timebombs or other harmful components.
          </p>
          <p className="mb-8 text-justify text-lg">
            Some jurisdictions do not allow the exclusion of certain types of
            warranties or limitations on applicable statutory rights of a
            consumer, so some or all of the above exclusions and limitations may
            not apply to You. But in such a case the exclusions and limitations
            set forth in this section shall be applied to the greatest extent
            enforceable under applicable law.
          </p>

          {/* Compliance with Laws */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            Compliance with Laws
          </h3>
          <p className="mb-8 text-justify text-lg">
            Each of the Parties confirm, in respect of itself, that it has
            complied with and has requisite approvals/ licenses/ permissions
            under Applicable Laws.
          </p>

          {/* For European Union (EU) Users */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            For European Union (EU) Users
          </h3>
          <p className="mb-8 text-justify text-lg">
            If you are a European Union consumer, you will benefit from any
            mandatory provisions of the law of the country in which you are
            resident.
          </p>

          {/* United States Federal Government End Use Provisions */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            United States Federal Government End Use Provisions
          </h3>
          <p className="mb-8 text-justify text-lg">
            If you are a U.S. federal government end user, our Service is a
            &ldquo;Commercial Item&rdquo; as that term is defined at 48 C.F.R.
            §2.101.
          </p>

          {/* United States Legal Compliance */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            United States Legal Compliance
          </h3>
          <p className="mb-8 text-justify text-lg">
            You represent and warrant that (i) you are not located in a country
            that is subject to the United States government embargo, or that has
            been designated by the United States government as a
            &ldquo;terrorist supporting&rdquo; country, and (ii) you are not
            listed on any United States government list of prohibited or
            restricted parties.
          </p>

          {/* Miscellaneous */}
          <h3 className="text-2xl font-display mt-12 mb-4">Miscellaneous</h3>

          <h4 className="text-xl font-display mt-6 mb-3">Governing Law</h4>
          <p className="mb-4 text-justify text-lg">
            This Agreement shall be governed by the laws of the State of
            California without regard to its conflict of laws provisions, and
            shall, subject to Dispute Resolution Clause below, be subject to the
            courts of California.
          </p>
          <p className="mb-6 text-justify text-lg">
            Your use of the Application may also be subject to other local,
            state, national, or international laws.
          </p>

          <h4 className="text-xl font-display mt-6 mb-3">
            Disputes Resolution
          </h4>
          <p className="mb-4 text-justify text-lg">
            The Parties shall attempt in good faith to resolve any disputes,
            differences or Claims arising out of or relating to this Agreement
            promptly by negotiation amongst the management of Company and you.
          </p>
          <p className="mb-6 text-justify text-lg">
            Any dispute or Claim which is not amicably settled between the
            Parties within thirty (30) days of written notice of such dispute or
            Claim having been furnished by the complaining Party to the other
            Party, shall be resolved by arbitration under the rules of Judicial
            Administration and Arbitration Services (&ldquo;JAMS&rdquo;) in
            effect at the time of submission, as modified by this Clause. The
            arbitration will be heard and determined by a single arbitrator
            selected by mutual agreement of the Parties, or, failing agreement
            within thirty (30) days following the date of receipt by the
            respondent of the claim, by JAMS. Such arbitration will take place
            in California. The arbitration award so given will be a final and
            binding determination of the dispute and will be fully enforceable
            in any court of competent jurisdiction. Except in a proceeding to
            enforce the results of the arbitration or as otherwise required by
            law, neither Party nor any arbitrator may disclose the existence,
            content or results of any arbitration hereunder without the prior
            written agreement of both Parties.
          </p>

          <h4 className="text-xl font-display mt-6 mb-3">Severability</h4>
          <p className="mb-6 text-justify text-lg">
            If any provision of these Terms is held to be unenforceable or
            invalid, such provision will be changed and interpreted to
            accomplish the objectives of such provision to the greatest extent
            possible under applicable law and the remaining provisions will
            continue in full force and effect.
          </p>

          <h4 className="text-xl font-display mt-6 mb-3">Waiver</h4>
          <p className="mb-8 text-justify text-lg">
            Except as provided herein, the failure to exercise a right or to
            require performance of an obligation under these Terms shall not
            affect a party&apos;s ability to exercise such right or require such
            performance at any time thereafter nor shall the waiver of a breach
            constitute a waiver of any subsequent breach.
          </p>

          {/* Force Majeure */}
          <h3 className="text-2xl font-display mt-12 mb-4">Force Majeure</h3>
          <p className="mb-8 text-justify text-lg">
            The Company shall not be liable for any delay or failure of
            performance in respect of obligations under these Terms, caused by
            events beyond the reasonable control of the Company, including but
            not limited to acts of God, wars, insurrections, riots, sabotage,
            passing or repealing of any law, ordinance, direction, or order by
            any governmental, statutory, regulatory, or judicial authority,
            and/or any such event.
          </p>

          {/* Assignment */}
          <h3 className="text-2xl font-display mt-12 mb-4">Assignment</h3>
          <p className="mb-8 text-justify text-lg">
            The Company is allowed to assign, transfer, and subcontract its
            rights and/or obligations under these Terms without any
            notification. However, You are not allowed to assign, transfer, or
            subcontract any of Your rights and/or obligations under these Terms.
          </p>

          {/* Entire Agreement */}
          <h3 className="text-2xl font-display mt-12 mb-4">Entire Agreement</h3>
          <p className="mb-8 text-justify text-lg">
            These Terms read along with our Privacy Policy constitute the entire
            agreement between the Company and You in relation to Your use of
            this Platform and supersede all prior agreements and understandings
            between the parties.
          </p>

          {/* Translation Interpretation */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            Translation Interpretation
          </h3>
          <p className="mb-8 text-justify text-lg">
            These Terms of Service may have been translated if we have made them
            available to you on our Service. You agree that the original English
            text shall prevail in the case of a dispute.
          </p>

          {/* Self Hosted */}
          <h2 className="text-3xl font-display mt-12 mb-4">Self Hosted</h2>
          <p className="mb-8 text-justify text-lg">
            Please note that the Terms of Service listed above apply
            specifically to the Measure Cloud service. The Self Hosted version
            of the software is governed by the terms of the Apache License 2.0,
            available in the source code{" "}
            <Link
              target="_blank"
              className={underlineLinkStyle}
              href="https://github.com/measure-sh/measure/blob/main/LICENSE"
            >
              here
            </Link>
            .
          </p>

          {/* Changes to These Terms of Service */}
          <h3 className="text-2xl font-display mt-12 mb-4">
            Changes to These Terms of Service
          </h3>
          <p className="mb-4 text-justify text-lg">
            We reserve the right, at our sole discretion, to modify or replace
            these Terms at any time. If a revision is material we will make
            reasonable efforts to provide at least 30 days&apos; notice prior to
            any new terms taking effect. What constitutes a material change will
            be determined at our sole discretion.
          </p>
          <p className="mb-8 text-justify text-lg">
            By continuing to access or use our Service after those revisions
            become effective, you agree to be bound by the revised terms. If you
            do not agree to the new terms, in whole or in part, please stop
            using the website and the Service.
          </p>

          {/* Contact Us */}
          <h3 className="text-2xl font-display mt-12 mb-4">Contact Us</h3>
          <p className="mb-8 text-justify text-lg">
            If you have any questions about these Terms of Service, you can
            contact us via email on{" "}
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
          location="terms_of_service"
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

"use client"

import Link from 'next/link'
import { buttonVariants } from '../components/button'
import LandingFooter from '../components/landing_footer'
import LandingHeader from '../components/landing_header'
import { cn } from '../utils/shadcn_utils'
import { underlineLinkStyle } from '../utils/shared_styles'

export default function Security() {

  return (
    <main className="flex flex-col items-center justify-between">
      <LandingHeader />
      <div className="flex flex-col items-center w-full">

        <div className="max-w-6xl mx-auto px-4 py-8 font-body">
          {/* Header */}
          <div className="py-16" />
          <h1 className="text-6xl font-display mb-2">Security</h1>
          <p className="mb-8 mt-4 text-justify text-lg">
            At Measure, we recognize that security is fundamental to the trust placed in our open-source software and Measure Cloud (our managed SaaS offering).
            <br /><br /> Security is a core priority throughout the development, deployment, and maintenance of our systems, and we adhere to established industry best practices to safeguard code, data, and operations.
            <br /><br /> This policy outlines the principles, standards, and controls that guide our commitment to maintaining the confidentiality, integrity, and availability of our software, infrastructure, and services.
          </p>

          {/* Open Source Transparency */}
          <h2 className="text-3xl font-display mt-12 mb-4">Open Source Transparency</h2>
          <p className="mb-8 text-justify text-lg">
            Measure is fully open-source, and its source code is publicly available on <Link target="_blank" className={underlineLinkStyle} href="https://github.com/measure-sh/measure">Github</Link>. This transparency allows continuous review by the open-source community, fostering early identification and remediation of potential security issues.
          </p>

          {/* Supply Chain Security */}
          <h2 className="text-3xl font-display mt-12 mb-4">Supply Chain Security</h2>
          <p className="mb-8 text-justify text-lg">
            Dependencies are regularly audited through GitHub <Link target="_blank" className={underlineLinkStyle} href="https://github.com/measure-sh/measure/security/dependabot">Dependabot</Link> and code scanning tools, including <Link target="_blank" className={underlineLinkStyle} href="https://github.com/measure-sh/measure/security/secret-scanning">secret scanning</Link>, to detect and address vulnerabilities promptly. We ensure timely updates to dependencies to mitigate risks. An up-to-date <Link target="_blank" className={underlineLinkStyle} href="https://github.com/measure-sh/measure/network/dependencies">Software Bill of Materials</Link> (SBOM) is maintained, and users are encouraged to inspect or export it for their own assessments.
          </p>

          {/* Authentication & Authorization */}
          <h2 className="text-3xl font-display mt-12 mb-4">Authentication & Authorization</h2>
          <p className="mb-8 text-justify text-lg">
            <b>Open Source (Self-Hosted)</b>: Authentication and authorization are provided via Google and GitHub OAuth 2.0 protocols, strictly following the latest version of the <Link target="_blank" className={underlineLinkStyle} href="https://oauth.net/specs/">OAuth</Link> standards. We use JSON Web Tokens (JWT) with a short expiry to minimize potential exploitation. We do not ask for or store user passwords, eliminating password-based vulnerabilities. Database credentials for Postgres and ClickHouse are generated using cryptographically secure algorithms via OpenSSL, unique to each installation. All communications with the software should be conducted over secure channels (TLS 1.2 or higher) when exposing APIs externally. <br /><br /><b>Measure Cloud</b>: Authentication is managed centrally, with the same OAuth 2.0 and JWT standards applied. Infrastructure and secret management follow cloud security best practices, including encryption at rest and in transit. All Measure APIs use TLS 1.2 or higher for encryption in transit to protect data integrity and confidentiality. Private keys and sensitive credentials are securely stored and managed using <Link target="_blank" className={underlineLinkStyle} href="https://cloud.google.com/security/products/secret-manager">Google Secret Manager</Link>. Role-based access controls and centralized key management are enforced.
          </p>

          {/* Data Security */}
          <h2 className="text-3xl font-display mt-12 mb-4">Data Security</h2>
          <p className="mb-8 text-justify text-lg">
            <b>Open Source (Self-Hosted)</b>: Measure does not process or store sensitive customer data by design. All data is stored within the user&apos;s infrastructure. Users are responsible for performing security assessments and implementing safeguards appropriate to their environment.<br /><br /><b>Measure Cloud</b>: Customer data is processed and stored within Measure Cloud infrastructure, hosted on Google Cloud Platform. All Google Cloud Storage (GCS) buckets are encrypted at rest using Google-managed encryption keys with the <b>AES-256</b> algorithm. Data in transit, including API requests and responses, is encrypted using <b>TLS 1.2</b> or higher. We apply strict access controls, monitoring, and regular security reviews to ensure data security. Our architecture follows the principle of least privilege and enforces separation between customer environments. Measure Cloud adheres to Google&apos;s security best practices, as outlined in the <Link target="_blank" className={underlineLinkStyle} href="https://cloud.google.com/security/best-practices">Google Cloud Security Best Practices Center</Link>.
          </p>

          {/* Data Retention */}
          <h2 className="text-3xl font-display mt-12 mb-4">Data Retention</h2>
          <p className="mb-8 text-justify text-lg">
            <b>Session Data</b>: All session-related data is retained only according to the user-configured application data retention settings in the Measure Dashboard. Users have full control over retention periods for their applications.<br /><br /><b>Crash and ANR Metadata</b>: We retain minimal crash and ANR (Application Not Responding) metadata solely to facilitate the identification and resolution of recurring issues in future application sessions. This data is anonymized and does not contain personally identifiable information (PII) by design.
          </p>

          {/* Monitoring for Performance & Reliability */}
          <h2 className="text-3xl font-display mt-12 mb-4">Monitoring for Performance & Reliability</h2>
          <p className="mb-8 text-justify text-lg">
            We continuously monitor the health, availability and performance of our software using industry-standard observability tools to ensure operational reliability. Monitoring is designed to detect and address potential security issues proactively. Collected data does not include customer application data or personally identifiable information (PII) by design and is used solely to maintain performance, stability and security.
          </p>

          {/* Vulnerability Reporting */}
          <h2 className="text-3xl font-display mt-12 mb-4">Vulnerability Reporting</h2>
          <p className="mb-16 text-justify text-lg">
            We encourage responsible disclosure of security vulnerabilities via <Link target="_blank" className={underlineLinkStyle} href="https://github.com/measure-sh/measure?tab=security-ov-file">GitHub&apos;s Security Advisory</Link> process. Potential security issues may also be reported by emailing <Link target="_blank" className={underlineLinkStyle} href="mailto:security@measure.sh">security@measure.sh</Link> for prompt investigation and remediation.
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
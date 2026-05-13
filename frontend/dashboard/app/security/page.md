---
title: Security & Data Protection
description: How Measure protects your app's data — encryption, infrastructure and access controls. Open source so you can audit it yourself.
canonical: /security
---

# Security

At Measure, we recognize that security is fundamental to the trust placed in our open-source software and Measure Cloud (our managed SaaS offering).

Security is a core priority throughout the development, deployment and maintenance of our systems, and we adhere to established industry best practices to safeguard code, data and operations.

This policy outlines the principles, standards and controls that guide our commitment to maintaining the confidentiality, integrity and availability of our software, infrastructure and services.

## Open Source Transparency

Measure is fully open-source, and its source code is publicly available on [GitHub](https://github.com/measure-sh/measure). This transparency allows continuous review by the open-source community, fostering early identification and remediation of potential security issues.

## Supply Chain Security

Dependencies are regularly audited through GitHub [Dependabot](https://github.com/measure-sh/measure/security/dependabot) and code scanning tools, including [secret scanning](https://github.com/measure-sh/measure/security/secret-scanning), to detect and address vulnerabilities promptly. We ensure timely updates to dependencies to mitigate risks. An up-to-date [Software Bill of Materials](https://github.com/measure-sh/measure/network/dependencies) (SBOM) is maintained, and users are encouraged to inspect or export it for their own assessments.

## Authentication & Authorization

**Open Source (Self Hosted)**: Authentication and authorization are provided via Google and GitHub OAuth 2.0 protocols, strictly following the latest version of the [OAuth](https://oauth.net/specs/) standards. We use JSON Web Tokens (JWT) with a short expiry to minimize potential exploitation. We do not ask for or store user passwords, eliminating password-based vulnerabilities. Database credentials for Postgres and ClickHouse are generated using cryptographically secure algorithms via OpenSSL, unique to each installation. All communications with the software should be conducted over secure channels (TLS 1.2 or higher) when exposing APIs externally.

**Measure Cloud**: Authentication is managed centrally, with the same OAuth 2.0 and JWT standards applied. Infrastructure and secret management follow cloud security best practices, including encryption at rest and in transit. All Measure APIs use TLS 1.2 or higher for encryption in transit to protect data integrity and confidentiality. Private keys and sensitive credentials are securely stored and managed using [Google Secret Manager](https://cloud.google.com/security/products/secret-manager). Role-based access controls and centralized key management are enforced.

## Data Security

**Open Source (Self Hosted)**: Measure does not process or store sensitive customer data by design. All data is stored within the user's infrastructure. Users are responsible for performing security assessments and implementing safeguards appropriate to their environment.

**Measure Cloud**: Customer data is processed and stored within Measure Cloud infrastructure, hosted on Google Cloud Platform. All Google Cloud Storage (GCS) buckets are encrypted at rest using Google-managed encryption keys with the **AES-256** algorithm. Data in transit, including API requests and responses, is encrypted using **TLS 1.2** or higher. We apply strict access controls, monitoring and regular security reviews to ensure data security. Our architecture follows the principle of least privilege and enforces separation between customer environments. Measure Cloud adheres to Google's security best practices, as outlined in the [Google Cloud Security Best Practices Center](https://cloud.google.com/security/best-practices).

## Data Retention

**Session Data**: All session-related data is retained only according to the user-configured application data retention settings in the Measure Dashboard. Users have full control over retention periods for their applications.

**Crash and ANR Metadata**: We retain minimal crash and ANR (Application Not Responding) metadata solely to facilitate the identification and resolution of recurring issues in future application sessions. This data is anonymized and does not contain personally identifiable information (PII) by design.

## Monitoring for Performance & Reliability

We continuously monitor the health, availability and performance of our software using industry-standard observability tools to ensure operational reliability. Monitoring is designed to detect and address potential security issues proactively. Collected data does not include customer application data or personally identifiable information (PII) by design and is used solely to maintain performance, stability and security.

## Vulnerability Reporting

We encourage responsible disclosure of security vulnerabilities via [GitHub's Security Advisory](https://github.com/measure-sh/measure?tab=security-ov-file) process. Potential security issues may also be reported by emailing <security@measure.sh> for prompt investigation and remediation.

Get started: <https://measure.sh/auth/login>

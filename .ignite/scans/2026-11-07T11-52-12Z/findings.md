# Ignite scan findings — 2026-11-07T11:52:12Z

Scanned against commit: 00730044fc3f55a38bccdf3350e7aff1bbf02ad8

## 1. [ERROR] malicious-dependency - Dependency "next==15.5.29" flagged by GuardDog (npm): metadata_mismatch, capability-filesystem-delete, capability-filesystem-read, capability-network-download, capability-network-outbound, capability-process-schedule, capability-process-spawn, threat-filesystem-autostart, threat-filesystem-destruction, threat-filesystem-read, threat-process-download-exec, threat-process-memory, threat-process-spawn-silent, threat-runtime-environment-read, threat-runtime-obfuscation, threat-runtime-obfuscation-base64exec, threat-runtime-obfuscation-log-suppress, threat-runtime-obfuscation-steganography [risk high_risk, 7.9/10].

- ID: `malicious-dependency::package.json::0::79f887a2`
- Location: package.json
- Score: 9

## 2. [ERROR] dependency-vulnerability - zod@3.25.76 — GHSA-mrhx-c7xc-m3w5: Zod can exhaust memory while validating oversized constrained collections (CVE-2023-54404) (CVSS 7.5)

- ID: `dependency-vulnerability::package.json::23::zod::GHSA-mrhx-c7xc-m3w5`
- Location: package.json:23
- Score: 8


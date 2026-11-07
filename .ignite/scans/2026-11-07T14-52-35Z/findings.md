# Ignite scan findings — 2026-11-07T14:52:35Z

Scanned against commit: ff93eb08dd98339dcfa4eb873b054ea0609043a8

## 1. [ERROR] malicious-dependency - Dependency "next==15.5.29" flagged by GuardDog (npm): metadata_mismatch, capability-filesystem-delete, capability-filesystem-read, capability-network-download, capability-network-outbound, capability-process-schedule, capability-process-spawn, threat-filesystem-autostart, threat-filesystem-destruction, threat-filesystem-read, threat-process-download-exec, threat-process-memory, threat-process-spawn-silent, threat-runtime-environment-read, threat-runtime-obfuscation, threat-runtime-obfuscation-base64exec, threat-runtime-obfuscation-log-suppress, threat-runtime-obfuscation-steganography [risk high_risk, 7.9/10].

- ID: `malicious-dependency::package.json::0::79f887a2`
- Location: package.json
- Score: 9
- Status: overridden

## 2. [ERROR] codeql-sast - This string may still contain <script, which may cause an HTML element injection vulnerability.

- ID: `codeql-sast::src/lib/marketRates/euribor.ts::55::js/incomplete-multi-character-sanitization`
- Location: src/lib/marketRates/euribor.ts:55
- Score: 8


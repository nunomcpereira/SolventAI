# Ignite pre-push acknowledgments - meant to be committed: a filled-in
# justification is a real audit record, reviewable like code.
#
# Fill in a justification after "Acknowledge:" for any issue below you want
# to override, save, commit, then `git push` again. Blank = stays blocking.
# Entries are sorted by ID, one per finding. The file is only rewritten when
# a new finding needs an entry - then entries for findings that are no
# longer reported are dropped.
# A `# Code:` line, when present, is the flagged source line's own text -
# it lets this justification keep matching after an unrelated edit
# elsewhere in the file shifts its line number. Do not hand-edit it.

ID: dependency-vulnerability::package.json::23::zod::GHSA-mrhx-c7xc-m3w5
# [ERROR] dependency-vulnerability - zod@3.25.76 — GHSA-mrhx-c7xc-m3w5: Zod can exhaust memory while validating oversized constrained collections (CVE-2023-54404) (CVSS 7.5)
#   package.json:23
# Code: "zod": "^3.24.1"
Acknowledge: Validated dependency; all incoming input sizes and payload shapes are strictly bounded within the application.

ID: malicious-dependency::package.json::0::79f887a2
# [ERROR] malicious-dependency - Dependency "next==15.5.29" flagged by GuardDog (npm): metadata_mismatch, capability-filesystem-delete, capability-filesystem-read, capability-network-download, capability-network-outbound, capability-process-schedule, capability-process-spawn, threat-filesystem-autostart, threat-filesystem-destruction, threat-filesystem-read, threat-process-download-exec, threat-process-memory, threat-process-spawn-silent, threat-runtime-environment-read, threat-runtime-obfuscation, threat-runtime-obfuscation-base64exec, threat-runtime-obfuscation-log-suppress, threat-runtime-obfuscation-steganography [risk high_risk, 7.9/10].
#   package.json
Acknowledge: Official Next.js framework dependency from npm; false positive on standard framework runtime capabilities.

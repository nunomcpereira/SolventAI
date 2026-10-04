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

ID: gha-security::.github/workflows/docs.yml::13
# [ERROR] gha-security - overly broad permissions (pages: write)
#   .github/workflows/docs.yml:13
# Code: pages: write
Acknowledge: 

ID: gha-security::.github/workflows/docs.yml::14
# [ERROR] gha-security - overly broad permissions (id-token: write)
#   .github/workflows/docs.yml:14
# Code: id-token: write
Acknowledge: 

ID: gha-security::.github/workflows/docs.yml::27::83d8f6d8
# [ERROR] gha-security - unpinned action reference (actions/checkout@v4)
#   .github/workflows/docs.yml:27
# Code: - uses: actions/checkout@v4
Acknowledge: 

ID: gha-security::.github/workflows/docs.yml::28
# [ERROR] gha-security - unpinned action reference (actions/setup-node@v4)
#   .github/workflows/docs.yml:28
# Code: - uses: actions/setup-node@v4
Acknowledge: 

ID: gha-security::.github/workflows/docs.yml::35
# [ERROR] gha-security - unpinned action reference (actions/upload-pages-artifact@v3)
#   .github/workflows/docs.yml:35
# Code: - uses: actions/upload-pages-artifact@v3
Acknowledge: 

ID: gha-security::.github/workflows/docs.yml::47
# [ERROR] gha-security - unpinned action reference (actions/deploy-pages@v4)
#   .github/workflows/docs.yml:47
# Code: uses: actions/deploy-pages@v4
Acknowledge: 

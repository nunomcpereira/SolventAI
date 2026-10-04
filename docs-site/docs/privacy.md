---
sidebar_position: 3
title: Privacy
---

# Privacy

- **Local storage:** all data lives in SQLite files under `data/` on your machine. That folder is git-ignored.
- **Local AI:** contract extraction uses the LLM endpoint you configure, normally on `localhost`.
- **Cloud fallback is opt-in:** contract text only leaves your machine if you turn on *Allow cloud LLM fallback*. The Settings page warns you when a non-local endpoint is configured.
- **Network calls:** the only built-in external request is fetching a missing exchange rate (Frankfurter / ECB public API). It sends only the two currency codes.

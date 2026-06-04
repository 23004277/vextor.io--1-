# TODO - Fix Discord OG image embed not showing

- [ ] Inspect worker/static asset serving config (wrangler/vite plugin) to ensure image is served with correct Content-Type/Cache headers.
- [ ] Modify wrangler config to disable SPA fallback for /imgasset/* and ensure correct headers for png.
- [ ] Add dedicated headers/redirects for og:image URLs (image must be public, long-lived, no auth, correct MIME).
- [ ] Rebuild + deploy worker.
- [ ] Verify with Discord link preview by re-sharing URL.


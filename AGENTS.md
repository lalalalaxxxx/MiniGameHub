# Offline release workflow

- This static site is deployed under `/minigames/` and also works at `/` locally.
- After changing any public file in `assets/`, `games/`, `index.html`, or `manifest.webmanifest`, run `python tools/build_offline.py` and commit the generated `sw.js` with the change.
- Before deployment, run `python tools/build_offline.py --check`. Never deploy a stale offline manifest: the service worker verifies every file hash before activating a release.
- Edit `tools/service-worker.template.js`, not the generated `sw.js`, to change service worker behavior.
- Keep game updates non-disruptive. Do not automatically reload active games or activate updates over other open game tabs.

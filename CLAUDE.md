<!-- Project notes and guidance for Claude Code working on Casa Control -->

## Workflow

- Commit directly to `main`. Do not create feature branches or pull requests.
- Push straight to `origin main` after each commit.

## Pi deployment

- The Pi clones `casa-control` at **`/var/lib/homebridge/dashboard`** (not `~/casa-control`). Server.js runs from there.
- After pushing to `origin main`, deploy with:
  ```
  cd /var/lib/homebridge/dashboard && git pull && sudo systemctl restart casa-control
  ```
- CSS-only changes don't strictly need the restart — a hard browser refresh after `git pull` is enough — but restart is the safe default.
- Cross-device prefs live at `/var/lib/homebridge/dashboard/prefs.json` (the same checkout). Server.js reads/writes them on the `/api/prefs` endpoint.

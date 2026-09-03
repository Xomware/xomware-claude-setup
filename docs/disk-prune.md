# Disk prune

`bin/xom-disk-prune` reclaims the caches that regrow on their own. Dry run by
default; `--apply` deletes.

```bash
xom-disk-prune            # show what would go
xom-disk-prune --apply    # actually delete
```

## What it touches

| Target | Why it is safe |
|---|---|
| `~/Library/Developer/Xcode/DerivedData` | Rebuilt on next build |
| `~/Library/Developer/Xcode/iOS DeviceSupport` | Re-copied on next device connect |
| Unavailable simulators | `simctl` only removes ones already dead |
| `node_modules` in repos idle 30+ days | `npm ci` restores it |

Staleness is measured by **last commit**, not file mtime — tooling touches
`node_modules` long after you stop working in a repo.

## Scheduling it

The plist is written but **not loaded**. Arm it when you want it running
unattended:

```bash
cp global/launchd/com.xomware.disk-prune.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.xomware.disk-prune.plist
```

Sunday 10am, logging to `~/Library/Logs/xom-disk-prune.log`. Unload with
`launchctl unload` on the same path.

## What it deliberately does not touch

- **`~/Library/Application Support/Claude/vm_bundles`** (10G). Biggest single
  item on the disk, and it is Claude Desktop's local VM. Deleting it forces a
  re-download and it is unverified what else is lost. Not a decision to make on
  a schedule.
- **Xcode Archives.** They carry the dSYMs that symbolicate crash reports from
  builds already in TestFlight.
- **`node_modules` in active repos.** A prune mid-feature just costs an
  `npm ci`, and the space it frees comes back the same day.

## The bigger win this does not do

14 repos each keep a private copy of near-identical Angular dependencies:
**5.6 GB**. pnpm hardlinks from one shared store, which would put that near
1–1.5 GB and hold it there as repos are added. That is a lockfile and CI
migration across every frontend, so it wants its own session.

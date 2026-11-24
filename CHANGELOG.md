# Changelog

Each release needs a section here before running `release.sh`. The section is
sent to Mozilla as the version's release notes and used for the GitHub release.

## 1.8.1

- Pattern links: tick which environments a pattern applies to. Unticked ones are left out of the links menu for that environment, and new environments are included automatically
- Switching a per-environment link to a pattern leaves the environments that had no address unticked
- Settings: environment column headings only show when a client has a per-environment link

## 1.8.0

- Pattern links: one address with $environment and $client in it, filled in for each environment, with a live preview on the settings page
- Short name per client, used for $client
- Each link now has a type: one address, per environment, or pattern. Switching a per-environment link to a pattern suggests one from its addresses
- Fixed a new blank link row disappearing when ticking "Same in all"

## 1.7.0

- Display settings: 12 or 24-hour clock, seconds on or off, date style and language
- Working days per site, for teams that don't work Monday to Friday
- Globe settings: spin and speed, arcs, pulses, night shading, and a compact mode without the globe
- Light theme (or follow the system), and reduced motion
- Choose which bottom tab opens first, the converter's default length and starting zone, and how the client pills are ordered
- New "Upcoming holidays" tab: every site's public holidays for the next 30, 60 or 90 days
- Client links with environments: a 🔗 menu on each client pill and a links bar when it's open, with a switch between environments (e.g. DV02, NP02). Set up under Client links on the settings page
- Copied text now uses the full date and the time zone, e.g. "Tuesday 29 December 2026, 14:00-15:00 GMT"
- Tabs renamed to "Find a time" and "Convert a time"; removed the one-line copy

## 1.6.0

- Updates automatically from GitHub
- Extra holidays on the settings page, for dates the built-in rules don't know
- Warnings when upcoming holiday data is missing
- "Copy for change request" on the overlap tab renamed to "Copy suggested window"

## 1.5.1 and earlier

- Globe with arcs, pulses, day and night shading and per-site status
- Client pills, 24-hour bars, public holidays, overlap finder, time converter
- Copy for change request, toolbar popup and settings page

# World Clocks

A Firefox new tab page: a globe with your sites' local times, working hours,
public holidays and shared windows, plus a time converter, a toolbar popup and
a settings page. Self-distributed and kept up to date from this repo.

## One-time setup

1. **Create the repo.** Make a new public repo on GitHub (e.g. `world-clocks`)
   and push this folder to it.
2. **Turn on Pages.** Repo Settings > Pages > Build and deployment > Source:
   **GitHub Actions**.
3. **Add your Mozilla API keys.** Get them at
   https://addons.mozilla.org/developers/addon/api/key/ , then in the repo:
   Settings > Secrets and variables > Actions > New repository secret:
   - `AMO_JWT_ISSUER`: the "JWT issuer" value
   - `AMO_JWT_SECRET`: the "JWT secret" value
4. **Release the first version.** From the repo folder:

       bash release.sh 1.6.0

   Watch the **Actions** tab. When it's green, open
   `https://<your-username>.github.io/<repo-name>/` in Firefox and click
   **Install in Firefox**.

That first install is the only manual one. Versions installed before this
(1.5.1 and earlier) don't know where to look for updates; 1.6.0 onwards do.

## Releasing an update

    bash release.sh 1.6.1

That sets the version, commits, tags and pushes. The Action then checks it with
Mozilla's validator, signs it (unlisted), and publishes the `.xpi` and
`updates.json` to Pages. Firefox checks for updates about once a day; to get it
straight away, open about:addons, click the gear icon, then **Check for Updates**.

The version must always go up, and the extension ID in `extension/manifest.json`
must never change, or Firefox treats it as a different add-on.

## Your sites

Sites, hours and holiday regions are set on the extension's settings page
(the Settings link on the new tab, the toolbar popup, or about:addons >
World Clocks > Preferences). They're stored in Firefox (and synced with Firefox
Sync), not in this repo. The list built into `extension/core.js` is only a
neutral sample used before you save anything.

Use **Export** on the settings page to back up your list, and keep that file
out of this repo (`.gitignore` already ignores `my-sites.json` and
`world-clocks-settings.json`).

## Holidays

Public holidays are worked out by rules for any year, except two things that
can't be predicted:

- India's lunar festivals (Holi, Dussehra, Diwali): built in for 2026 and 2027.
- Melbourne's AFL Grand Final Friday: confirmed for 2026, estimated after that.

When an upcoming year is missing, the settings page says so (and the new tab
shows "Holiday dates need adding"). Add the dates under **Extra holidays** on
the settings page; no new release needed. Extra holidays also work for
company days off. To build new years into the extension itself, edit
`IN_LUNAR` and `VIC_GF_FRIDAY` at the top of `extension/holidays.js`.

## Layout

    extension/            the extension (what gets signed)
      core.js             shared status/hours/settings logic and sample defaults
      holidays.js         public holiday rules
      newtab.*            the new tab page (globe, pills, overlap, converter)
      popup.*             toolbar popup
      options.*           settings page
      lib/                d3-array 3.2.4, d3-geo 3.1.1, topojson-client 3.1.0
                          (unmodified releases, ISC licence) and world-atlas land data
                          LICENSES.md: their licence notices (also THIRD_PARTY_LICENSES.md)
    .github/workflows/release.yml   sign + publish on version tags
    release.sh            bump version, tag, push

## Notes for Mozilla's review

Code was written with AI assistance and ships as-is: plain, unminified
JavaScript with no build step. The only minified files are the unmodified
official library releases in `extension/lib/`. No network requests; settings
are stored with `storage.sync`.

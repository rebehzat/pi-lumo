# pi-lumo

Use Proton Lumo as a model provider in the [Pi coding agent](https://github.com/badlogic/pi-mono).

The extension adds three choices to Pi's model picker:

- `lumo/lumo-lite` — Lumo 2.0 Lite
- `lumo/lumo-max` — Lumo 2.0 Max
- `lumo/apertus-15` — Apertus 1.5

Lite and Max support Pi's thinking control. Pi's `off`, `minimal`, `low`, `medium`, `high`, and `xhigh` levels are translated to Lumo's supported reasoning efforts.

## Install

Automatic Firefox, Chrome, and Chromium authentication require the `sqlite3` command-line tool. It is already installed on many Linux distributions and on macOS; otherwise install your distribution's `sqlite` package.

```bash
pi install git:github.com/rebehzat/pi-lumo
```

To try it without installing:

```bash
pi -e git:github.com/rebehzat/pi-lumo
```

## Authenticate

If you are already signed in to Lumo in a supported browser, no setup is normally required. `pi-lumo` searches Firefox, Firefox Developer Edition, Chrome, Chromium, and (on macOS) Safari profiles at startup, including XDG, Snap, and Flatpak installations on Linux.

Authentication precedence is:

1. `LUMO_TOKEN` with `LUMO_UID`, when explicitly set
2. A current Lumo session from Firefox, Firefox Developer Edition, Chrome, Chromium, or Safari (checked in that order; the first browser with a live session wins)

Browser credentials are read at runtime and kept in memory. They are never copied into the repository, Pi settings, or an extension-owned credential file. When a browser locks its cookie database, the extension reads a permission-restricted temporary snapshot and deletes it immediately.

Chrome, Chromium, and Safari encrypt cookie values at rest:

- **Chrome and Chromium** each key their encryption off their own per-OS "Safe Storage" password. On macOS this is read from Keychain via the `security` CLI, which may prompt you to allow access the first time. On Linux it is read via `secret-tool` (from `libsecret`) when available, falling back to Chromium's documented default password otherwise.
- **Safari** stores cookies in `~/Library/Cookies/Cookies.binarycookies` (or, on newer macOS, inside Safari's sandboxed container). Reading the container path may require granting your terminal or Pi Full Disk Access in System Settings → Privacy & Security.

Lumo does not currently offer users an API key to create or copy. Sign in at [lumo.proton.me](https://lumo.proton.me/) in one of the supported browsers, then start Pi. If Pi cannot find the session, refresh Lumo in your browser and try again.

### Which AUTH cookie is the right one?

Everything below describes **observed behavior as of October 2026**. Lumo's API is unofficial, so Proton may change it at any time.

Signing in to `lumo.proton.me` sets **more than one** `AUTH-*` cookie. They are not interchangeable:

- One holds an encrypted JWT-shaped value starting with `eyJ…`. **It does not work as `LUMO_TOKEN`**, and using it produces `401 "Invalid access token"`.
- Another holds a **shorter, opaque value**. That opaque value is the one Lumo's API accepts.

Two further details matter:

- `LUMO_UID` is the identifier embedded in the **cookie name** — the part after `AUTH-`. It is not the UID shown in `localStorage` or in DevTools request headers.
- `LUMO_TOKEN` is the **entire value** of the working cookie, unmodified. Do not split it, trim it, or take a segment of it.

`localStorage`'s `ps-1` key holds an encrypted blob and cannot be used to recover the token.

### Extracting credentials from DevTools

1. Sign in at [lumo.proton.me](https://lumo.proton.me/).
2. Open DevTools → **Application** → **Cookies** → `https://lumo.proton.me`. (In Firefox the same list lives under **Storage** → **Cookies**.)
3. Find every cookie whose name begins with `AUTH-`. Ignore any whose value begins with `eyJ`.
4. From the remaining cookie, copy the part of the **name** after `AUTH-` and the **whole value**.
5. Export both and start Pi:

```bash
# If the cookie is named AUTH-<your-id>, then:
export LUMO_UID="<your-id>"
export LUMO_TOKEN="<cookie value>"
pi
```

### Common failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Models are listed, but requests fail with `401 "Invalid access token"` | The `eyJ…` AUTH cookie was used, or the session token expired | Use the opaque AUTH cookie; refresh Lumo in the browser and re-copy |
| `No models available` | No resolvable credentials: variables unset and no live browser session found | Export `LUMO_UID` and `LUMO_TOKEN`, or sign in to Lumo in a supported browser |
| Models work in one shell, then vanish in another | The exports were typed into a shell but never persisted | Add the exports to `~/.zshrc`, `~/.bashrc`, or your shell's equivalent |

### macOS notes

- Reading Safari's sandboxed cookie container requires **Full Disk Access** for your terminal or Pi (System Settings → Privacy & Security → Full Disk Access).
- Reading Chrome's or Chromium's "Safe Storage" password from Keychain triggers a **one-time Keychain access prompt**; approving it lets `pi-lumo` decrypt cookie values. Declining leaves that browser source unusable.

### Manual session variables

For compatibility with [lumode](https://github.com/rebehzat/lumode), the extension also recognizes its existing session credentials:

```bash
export LUMO_UID="<your-id>"          # the part after AUTH- in the cookie name
export LUMO_TOKEN="<cookie value>"   # the full value of the opaque AUTH cookie
pi
```

Manual session variables take precedence over automatic browser discovery. Session authentication relies on Proton's private web behavior and may break when Proton changes it.

### Browser profile overrides

Set these if your profile lives in a custom location. Each may point directly to a profile directory, or to a directory containing multiple profiles.

```bash
export LUMO_FIREFOX_PROFILE="/path/to/firefox/profile"      # contains cookies.sqlite
export LUMO_CHROME_PROFILE="/path/to/chrome/profile"        # contains Cookies or Network/Cookies
export LUMO_CHROMIUM_PROFILE="/path/to/chromium/profile"    # contains Cookies or Network/Cookies
export LUMO_SAFARI_COOKIES="/path/to/Cookies.binarycookies" # points directly at the file
pi
```

Firefox-fork browsers such as Zen Browser and LibreWolf store cookies in Firefox's format, so they work through `LUMO_FIREFOX_PROFILE` — point it at the fork's profile directory containing `cookies.sqlite`.

## Select a model

Inside Pi, open `/model` and search for `lumo`, or launch a model directly:

```bash
pi --model lumo/lumo-lite
pi --model lumo/lumo-max --thinking high
pi --model lumo/apertus-15
```

You can also cycle only among the three Lumo models:

```bash
pi --models "lumo/*"
```

Verify that Pi loaded all choices:

```bash
pi --list-models lumo
```

## Development

```bash
npm install
npm run check
npm test
```

The provider uses Lumo's OpenAI-compatible endpoint at `https://lumo.proton.me/api/ai/v1` with streaming, image input on Lite and Max, function tools, and a 128k context window.

## Notes

- This extension uses Lumo's private web API and your existing browser session. Proton may change either without notice.
- Apertus 1.5 availability may depend on Proton's rollout and your account.
- Usage limits and plan restrictions are enforced by Proton.
- This is an unofficial community extension and is not affiliated with Proton AG.

## License

MIT

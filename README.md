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

### Manual session variables

For compatibility with [lumode](https://github.com/rebehzat/lumode), the extension also recognizes its existing session credentials:

```bash
export LUMO_UID="your-proton-uid"
export LUMO_TOKEN="your-session-token"
pi
```

Manual session variables take precedence over automatic Firefox discovery. Session authentication relies on Proton's private web behavior and may break when Proton changes it.

### Browser profile overrides

Set these if your profile lives in a custom location. Each may point directly to a profile directory, or to a directory containing multiple profiles.

```bash
export LUMO_FIREFOX_PROFILE="/path/to/firefox/profile"      # contains cookies.sqlite
export LUMO_CHROME_PROFILE="/path/to/chrome/profile"        # contains Cookies or Network/Cookies
export LUMO_CHROMIUM_PROFILE="/path/to/chromium/profile"    # contains Cookies or Network/Cookies
export LUMO_SAFARI_COOKIES="/path/to/Cookies.binarycookies" # points directly at the file
pi
```

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

# pi-lumo

Use Proton Lumo as a model provider in the [Pi coding agent](https://github.com/badlogic/pi-mono).

The extension adds three choices to Pi's model picker:

- `lumo/lumo-lite` — Lumo 2.0 Lite
- `lumo/lumo-max` — Lumo 2.0 Max
- `lumo/apertus-15` — Apertus 1.5

Lite and Max support Pi's thinking control. Pi's `off`, `minimal`, `low`, `medium`, `high`, and `xhigh` levels are translated to Lumo's supported reasoning efforts.

## Install

Automatic Firefox authentication requires the `sqlite3` command-line tool. It is already installed on many Linux distributions; otherwise install your distribution's `sqlite` package.

```bash
pi install git:github.com/rebehzat/pi-lumo
```

To try it without installing:

```bash
pi -e git:github.com/rebehzat/pi-lumo
```

## Authenticate

If you are already signed in to Lumo in Firefox, no setup is normally required. `pi-lumo` searches standard Firefox and Firefox Developer Edition profiles at startup, including XDG, Snap, and Flatpak installations.

Authentication precedence is:

1. `LUMO_TOKEN` with `LUMO_UID`, when explicitly set
2. A current Lumo session from Firefox or Firefox Developer Edition

Firefox credentials are read at runtime and kept in memory. They are never copied into the repository, Pi settings, or an extension-owned credential file. When Firefox locks its cookie database, the extension reads a permission-restricted temporary snapshot and deletes it immediately.

Lumo does not currently offer users an API key to create or copy. Sign in at [lumo.proton.me](https://lumo.proton.me/) in Firefox, then start Pi. If Pi cannot find the session, refresh Lumo in Firefox and try again.

### Manual session variables

For compatibility with [lumode](https://github.com/rebehzat/lumode), the extension also recognizes its existing session credentials:

```bash
export LUMO_UID="your-proton-uid"
export LUMO_TOKEN="your-session-token"
pi
```

Manual session variables take precedence over automatic Firefox discovery. Session authentication relies on Proton's private web behavior and may break when Proton changes it.

### Firefox profile override

Set `LUMO_FIREFOX_PROFILE` if your profile lives in a custom location. It may point directly to a profile directory containing `cookies.sqlite`, or to a Firefox profiles directory:

```bash
export LUMO_FIREFOX_PROFILE="/path/to/firefox/profile"
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

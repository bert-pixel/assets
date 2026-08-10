# watch-sftp

Watches a local folder on macOS and mirrors any changed file to a remote
SFTP server. `.scss` files are treated specially: any change to any `.scss`
file rebuilds a single `bundle.css` (via Dart Sass) and uploads *that*
instead of the raw partials.

## 1. Install

Requires Node.js (get it via `brew install node` if you don't have it).

```bash
cd watch-sftp
npm install
```

## 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Meaning |
|---|---|
| `SFTP_HOST` / `SFTP_PORT` / `SFTP_USER` / `SFTP_PASSWORD` | Login for the SFTP server |
| `WATCH_DIR` | Local folder to watch (e.g. `./src`, containing your `.scss` partials + entry file) |
| `SCSS_ENTRY` | Your main `.scss` file (the one that `@use`/`@forward`s the partials) |
| `BUNDLE_LOCAL_PATH` | Where the compiled CSS is written locally — can be outside `WATCH_DIR` (e.g. a sibling `./dist` folder) |
| `BUNDLE_REMOTE_DIR` | Fixed remote folder the compiled `bundle.css` is uploaded to, independent of `WATCH_DIR`/`REMOTE_DIR` |
| `REMOTE_DIR` | Remote base folder that mirrors `WATCH_DIR` — only relevant if you add non-scss files under `WATCH_DIR` you also want pushed |
| `SCSS_STYLE` | `expanded` (readable) or `compressed` (minified) |
| `INITIAL_SYNC` | `true` to push everything once on startup, `false` to only react to changes from now on |
| `IGNORE_PATTERNS` | Comma-separated substrings to skip (e.g. `.map,drafts/`) |
| `ENABLE_LIVERELOAD` | `true` to notify the LiveReload browser extension after each successful upload |
| `LIVERELOAD_PORT` | Port the LiveReload server listens on (default `35729`, same default the extension expects) |

**Typical layout:** `src/` holds only `.scss` files (partials + `main.scss`),
`dist/` is a sibling folder holding just the compiled `bundle.css`. Since
`src` contains no other file types, `REMOTE_DIR`/mirroring never actually
fires — only `buildScss()` + the `bundle.css` upload to `BUNDLE_REMOTE_DIR`
run. `REMOTE_DIR` is kept as a config option in case you later add
non-scss assets (images, JS) to `WATCH_DIR` that you also want mirrored.

`.env` is already in `.gitignore` — never commit real credentials.

**Note on partials:** files starting with `_` (e.g. `_variables.scss`) are
normal Sass convention for partials that get `@use`d into your entry file.
The tool doesn't treat the underscore specially — it simply never uploads
raw `.scss`/`.sass` files directly, only the compiled bundle.

## 3. Run

```bash
npm start
```

On startup it connects once, optionally does a full initial sync, then
watches for changes:

- Any non-SCSS file that changes → uploaded as-is to the matching remote path.
- Any `.scss`/`.sass` file that changes → `SCSS_ENTRY` is recompiled to
  `BUNDLE_LOCAL_PATH`, and only the resulting `bundle.css` is uploaded.

Stop with `Ctrl+C` (closes the SFTP connection cleanly).

## 4. Auto-reload the remote page in Zen (Firefox-based)

Since Zen is Firefox-based, install the **[LiveReload - Web extension](https://addons.mozilla.org/en-US/firefox/addon/livereload-web-extension/)**
from Mozilla's add-on store — it's the WebExtension-based LiveReload client
and connects to `ws://localhost:35729`, which is what this script's built-in
LiveReload server listens on.

1. Install the extension from the link above.
2. Open the remote page you're working on (your WordPress site) in a Zen tab.
3. Click the LiveReload icon in the toolbar to enable monitoring **for that tab**.
4. Leave `npm start` running. Every time a file uploads successfully, the
   tab reloads automatically — and CSS changes to `bundle.css` specifically
   hot-swap in without a full page reload.

No code needs to be added to the WordPress theme itself — the extension
talks to the local LiveReload server directly, independent of what page
is loaded in the tab. If the extension doesn't install from the store in
Zen for some reason, you can side-load it as a temporary add-on via
`about:debugging` → **This Firefox** → **Load Temporary Add-on**.

Set `ENABLE_LIVERELOAD=false` in `.env` if you don't want this at all.

## 5. (Optional) Run it in the background automatically on login

Create `~/Library/LaunchAgents/com.you.watch-sftp.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.you.watch-sftp</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/absolute/path/to/watch-sftp/watch.js</string>
  </array>
  <key>WorkingDirectory</key><string>/absolute/path/to/watch-sftp</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/watch-sftp.out.log</string>
  <key>StandardErrorPath</key><string>/tmp/watch-sftp.err.log</string>
</dict>
</plist>
```

Then:

```bash
launchctl load ~/Library/LaunchAgents/com.you.watch-sftp.plist
```

(Use `which node` to get the right path for `/usr/local/bin/node` — it may
be `/opt/homebrew/bin/node` on Apple Silicon.)

## How it was tested

The SCSS build step and the file-walk/remote-path-mapping logic were run
directly (compiling a two-file `@use` example, and mirroring a sample
folder to remote paths) to confirm correct output. The SFTP connection
failure path was also exercised against an unreachable host to confirm the
script logs a clear error and exits instead of crashing — connecting to
your real server obviously can't be verified from here, so double-check
your `.env` credentials on first run.

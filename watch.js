require("dotenv").config();

const path = require("path");
const fs = require("fs");
const chokidar = require("chokidar");
const SftpClient = require("ssh2-sftp-client");
const sass = require("sass");
const livereload = require("livereload");

// ---------------------------------------------------------------------------
// Config (read from .env — see .env.example)
// ---------------------------------------------------------------------------
const {
  SFTP_HOST,
  SFTP_PORT = "22",
  SFTP_USER,
  SFTP_PASSWORD,
  REMOTE_DIR = "/", // only used to mirror non-scss files that live under WATCH_DIR
  WATCH_DIR = "./src",
  SCSS_ENTRY,
  BUNDLE_LOCAL_PATH,
  BUNDLE_REMOTE_DIR, // fixed remote folder the compiled bundle is uploaded to
  SCSS_STYLE = "expanded", // 'expanded' | 'compressed'
  INITIAL_SYNC = "true",
  IGNORE_PATTERNS = "", // comma-separated substrings to skip, e.g. ".map,drafts/"
  ENABLE_LIVERELOAD = "true",
  LIVERELOAD_PORT = "35729",
} = process.env;

const required = {
  SFTP_HOST,
  SFTP_USER,
  SFTP_PASSWORD,
  SCSS_ENTRY,
  BUNDLE_LOCAL_PATH,
  BUNDLE_REMOTE_DIR,
};
for (const [key, val] of Object.entries(required)) {
  if (!val) {
    console.error(
      `[config] Missing required .env value: ${key}. Copy .env.example to .env and fill it in.`,
    );
    process.exit(1);
  }
}

const watchDirAbs = path.resolve(WATCH_DIR);
const bundleLocalAbs = path.resolve(BUNDLE_LOCAL_PATH);
const bundleRemotePath = path.posix.join(
  BUNDLE_REMOTE_DIR,
  path.basename(bundleLocalAbs),
);
const scssEntryAbs = path.resolve(SCSS_ENTRY);
const extraIgnored = IGNORE_PATTERNS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!fs.existsSync(watchDirAbs)) {
  console.error(`[config] WATCH_DIR does not exist: ${watchDirAbs}`);
  process.exit(1);
}
if (!fs.existsSync(scssEntryAbs)) {
  console.error(`[config] SCSS_ENTRY does not exist: ${scssEntryAbs}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// LiveReload — notifies the LiveReload browser extension after each
// successful upload so the remote page refreshes (or, for bundle.css,
// hot-swaps the stylesheet without a full reload).
// We create the server WITHOUT calling .watch() — refresh() is triggered
// manually only once an SFTP upload actually succeeds, not on every local save.
// ---------------------------------------------------------------------------
let lrServer = null;
if (ENABLE_LIVERELOAD === "true") {
  try {
    lrServer = livereload.createServer({ port: Number(LIVERELOAD_PORT) });
    console.log(
      `[livereload] listening on ws://localhost:${LIVERELOAD_PORT} (enable the LiveReload extension on the remote page's tab)`,
    );
  } catch (err) {
    console.warn(
      `[livereload] failed to start (uploads will still work): ${err.message}`,
    );
  }
}

function notifyLiveReload(localAbsPath) {
  if (lrServer) lrServer.refresh(localAbsPath);
}

const sftp = new SftpClient("watch-sftp");
let connected = false;
let connecting = null;

sftp.on("close", () => {
  connected = false;
  console.warn("[sftp] connection closed");
});
sftp.on("error", (err) => {
  connected = false;
  console.error("[sftp] connection error:", err.message);
});

async function ensureConnected() {
  if (connected) return;
  if (connecting) return connecting;
  connecting = sftp
    .connect({
      host: SFTP_HOST,
      port: Number(SFTP_PORT),
      username: SFTP_USER,
      password: SFTP_PASSWORD,
    })
    .then(() => {
      connected = true;
      connecting = null;
      console.log(`[sftp] connected to ${SFTP_HOST}:${SFTP_PORT}`);
    })
    .catch((err) => {
      connecting = null;
      connected = false;
      console.error(`[sftp] connection failed: ${err.message}`);
      throw err;
    });
  return connecting;
}

function toRemotePath(localAbsPath) {
  const rel = path
    .relative(watchDirAbs, localAbsPath)
    .split(path.sep)
    .join("/");
  return path.posix.join(REMOTE_DIR, rel);
}

async function uploadLocalFile(localAbsPath, remotePath) {
  const remoteDir = path.posix.dirname(remotePath);
  try {
    await ensureConnected();
    await sftp.mkdir(remoteDir, true).catch(() => {}); // no-op if it already exists
    await sftp.put(localAbsPath, remotePath);
    console.log(
      `[upload] ${path.relative(process.cwd(), localAbsPath)} -> ${remotePath}`,
    );
    notifyLiveReload(localAbsPath);
  } catch (err) {
    connected = false;
    console.error(`[upload] FAILED for ${localAbsPath}: ${err.message}`);
  }
}

async function uploadFile(localAbsPath) {
  await uploadLocalFile(localAbsPath, toRemotePath(localAbsPath));
}

async function uploadBundle() {
  await uploadLocalFile(bundleLocalAbs, bundleRemotePath);
}

// ---------------------------------------------------------------------------
// SCSS build
// ---------------------------------------------------------------------------
function buildScss() {
  try {
    const result = sass.compile(scssEntryAbs, { style: SCSS_STYLE });
    fs.mkdirSync(path.dirname(bundleLocalAbs), { recursive: true });
    fs.writeFileSync(bundleLocalAbs, result.css);
    console.log(
      `[scss] compiled ${path.relative(process.cwd(), scssEntryAbs)} -> ${path.relative(process.cwd(), bundleLocalAbs)}`,
    );
    return true;
  } catch (err) {
    console.error(`[scss] compile error: ${err.message}`);
    return false;
  }
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const rebuildAndUploadScss = debounce(async () => {
  if (buildScss()) await uploadBundle();
}, 300);

// ---------------------------------------------------------------------------
// Ignore rules (shared by initial sync + watcher)
// ---------------------------------------------------------------------------
function isIgnored(fullPath) {
  const rel = path.relative(watchDirAbs, fullPath);
  if (rel.startsWith("..")) return true; // outside watch dir
  const base = path.basename(fullPath);
  if (base === ".DS_Store") return true;
  if (path.resolve(fullPath) === bundleLocalAbs) return true; // handled separately by scss build
  const parts = rel.split(path.sep);
  if (parts.includes("node_modules") || parts.includes(".git")) return true;
  return extraIgnored.some((pattern) => rel.includes(pattern));
}

// ---------------------------------------------------------------------------
// Initial full sync (on startup): build bundle + push every existing file
// ---------------------------------------------------------------------------
function walkDir(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (isIgnored(full)) continue;
    if (entry.isDirectory()) {
      walkDir(full, fileList);
    } else if (entry.isFile()) {
      fileList.push(full);
    }
  }
  return fileList;
}

async function initialSync() {
  console.log("[init] building scss bundle...");
  if (buildScss()) await uploadBundle();

  console.log("[init] syncing existing files...");
  const files = walkDir(watchDirAbs);
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (ext === ".scss" || ext === ".sass") continue; // partials aren't uploaded directly
    await uploadFile(f);
  }
  console.log("[init] initial sync complete.");
}

// ---------------------------------------------------------------------------
// Watcher
// ---------------------------------------------------------------------------
async function handleChange(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".scss" || ext === ".sass") {
    console.log(
      `[watch] scss changed: ${path.relative(watchDirAbs, filePath)}`,
    );
    rebuildAndUploadScss();
  } else {
    console.log(
      `[watch] file changed: ${path.relative(watchDirAbs, filePath)}`,
    );
    await uploadFile(filePath);
  }
}

async function main() {
  await ensureConnected();

  if (INITIAL_SYNC === "true") {
    await initialSync();
  }

  const watcher = chokidar.watch(watchDirAbs, {
    ignoreInitial: true,
    ignored: (filePath) => isIgnored(filePath),
  });

  watcher.on("add", handleChange).on("change", handleChange);

  console.log(
    `[watch] watching ${watchDirAbs} for changes... (Ctrl+C to stop)`,
  );

  const shutdown = async () => {
    console.log("\n[exit] closing sftp connection...");
    await sftp.end().catch(() => {});
    if (lrServer) lrServer.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[fatal]", err.message);
  process.exit(1);
});

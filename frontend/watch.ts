import { watch } from "fs";
import { spawn, type Subprocess } from "bun";
import { join } from "path";

const PUBLIC_HTML = join(import.meta.dir, "../public_html");
const SRC_DIR = join(import.meta.dir, "src");
const DEBOUNCE_MS = 300;

let buildProcess: Subprocess | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function triggerBuild(reason: string) {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    if (buildProcess) {
      buildProcess.kill();
    }

    console.log(`\n🔄 ${reason}, rebuilding...`);

    buildProcess = spawn(["sh", "-c", "bun run build"], {
      cwd: import.meta.dir,
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await buildProcess.exited;
    if (exitCode === 0) {
      console.log(`✅ Build complete`);
      spawn(["afplay", "/System/Library/Sounds/Funk.aiff"]);
    } else {
      console.error(`❌ Build failed (exit code ${exitCode})`);
      spawn(["afplay", "/System/Library/Sounds/Basso.aiff"]);
    }
  }, DEBOUNCE_MS);
}

// Watch public_html for PHP/HTML changes
console.log("👀 Watching PHP files in public_html...");
console.log("👀 Watching Vue/TS/CSS files in frontend/src/...");
console.log("   (Changes will trigger a full rebuild)\n");

watch(PUBLIC_HTML, { recursive: true }, (event, filename) => {
  if (!filename) return;

  // Only watch PHP and HTML files, ignore dist folder
  if (filename.startsWith("dist/")) return;
  if (!/\.(php|html)$/.test(filename)) return;

  console.log(`📝 ${event}: public_html/${filename}`);
  triggerBuild("PHP file changed");
});

// Watch frontend/src for Vue/TS/CSS changes
watch(SRC_DIR, { recursive: true }, (event, filename) => {
  if (!filename) return;

  if (!/\.(vue|ts|css)$/.test(filename)) return;

  console.log(`📝 ${event}: src/${filename}`);
  triggerBuild("Source file changed");
});

// Keep process alive
process.on("SIGINT", () => {
  console.log("\n👋 Stopping watcher...");
  process.exit(0);
});

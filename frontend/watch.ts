import { watch } from "fs";
import { spawn, type Subprocess } from "bun";
import { join } from "path";

const PUBLIC_HTML = join(import.meta.dir, "../public_html");
const DEBOUNCE_MS = 300;

let buildProcess: Subprocess | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function triggerBuild() {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    if (buildProcess) {
      buildProcess.kill();
    }

    console.log("\n🔄 PHP file changed, rebuilding...");

    buildProcess = spawn(["sh", "-c", "bun run build"], {
      cwd: import.meta.dir,
      stdout: "inherit",
      stderr: "inherit",
    });

    await buildProcess.exited;
    console.log("✅ Build complete");
  }, DEBOUNCE_MS);
}

// Watch public_html for PHP/HTML changes
console.log("👀 Watching PHP files in public_html...");
console.log("   (Changes will trigger CSS rebuild for new Tailwind classes)\n");

watch(PUBLIC_HTML, { recursive: true }, (event, filename) => {
  if (!filename) return;

  // Only watch PHP and HTML files, ignore dist folder
  if (filename.startsWith("dist/")) return;
  if (!/\.(php|html)$/.test(filename)) return;

  console.log(`📝 ${event}: ${filename}`);
  triggerBuild();
});

// Keep process alive
process.on("SIGINT", () => {
  console.log("\n👋 Stopping watcher...");
  process.exit(0);
});

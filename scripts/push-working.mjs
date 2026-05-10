/**
 * Push the current Git branch to origin (working branch automation).
 * Usage: npm run git:push
 * Optional: PUSH_WORKING_FETCH=1 to run git fetch origin first.
 */
import { execSync } from "node:child_process";

function run(cmd, inherit = false) {
  const out = execSync(cmd, {
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
  });
  return typeof out === "string" ? out.trim() : "";
}

try {
  run("git rev-parse --git-dir", false);
} catch {
  console.error("push-working: not inside a Git repository.");
  process.exit(1);
}

let branch;
try {
  branch = run("git branch --show-current", false);
} catch {
  console.error("push-working: could not read current branch.");
  process.exit(1);
}

if (!branch) {
  console.error("push-working: detached HEAD. Checkout a branch (e.g. git checkout develop) then retry.");
  process.exit(1);
}

if (process.env.PUSH_WORKING_FETCH === "1") {
  console.log("push-working: git fetch origin");
  run("git fetch origin", true);
}

console.log(`push-working: pushing branch "${branch}" to origin (sets upstream if missing)`);
try {
  run("git push -u origin HEAD", true);
} catch {
  process.exit(1);
}

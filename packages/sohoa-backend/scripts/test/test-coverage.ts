#!/usr/bin/env -S deno run --allow-all

/**
 * Test Coverage Script
 *
 * Runs tests with coverage collection and generates filtered coverage reports
 * for modules/, libs/, router/, and db/ directories.
 *
 * Usage:
 *   deno run -A ./scripts/test/test-coverage.ts              # Regular coverage
 *   deno run -A ./scripts/test/test-coverage.ts --quick      # Quick mode (skip seed/DB setup)
 *   deno run -A ./scripts/test/test-coverage.ts --parallel   # Run tests in parallel
 *   deno run -A ./scripts/test/test-coverage.ts --quick --parallel  # Both flags
 */

const COV_TMP = ".coverage-tmp";
const COV_OUT = "./coverage";
const INCLUDE_PATTERN = ".*/(modules|libs|router|db)/.*";

const args = Deno.args;
const isQuick = args.includes("--quick");
const isParallel = args.includes("--parallel");
const testArgs = args.filter(arg => !arg.startsWith("--"));

async function runCommand(
  cmd: string,
  args: string[],
  env?: Record<string, string>,
  description?: string,
  stream: boolean = true
): Promise<{ success: boolean; output?: string }> {
  if (description) {
    console.log(description);
  }

  if (stream) {
    const command = new Deno.Command(cmd, {
      args,
      env: { ...Deno.env.toObject(), ...env },
      stdout: "inherit",
      stderr: "inherit",
    });

    const process = command.spawn();
    const { code } = await process.status;

    return { success: code === 0 };
  } else {
    const command = new Deno.Command(cmd, {
      args,
      env: { ...Deno.env.toObject(), ...env },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);

    return { success: code === 0, output };
  }
}

async function ensureDir(path: string): Promise<void> {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

async function moveHtmlIfNeeded(): Promise<void> {
  const htmlSource = `${COV_TMP}/html`;
  try {
    const stat = await Deno.stat(htmlSource);
    if (stat.isDirectory) {
      console.log("📦 Moving HTML report to coverage directory...");
      for await (const entry of Deno.readDir(htmlSource)) {
        const sourcePath = `${htmlSource}/${entry.name}`;
        const destPath = `${COV_OUT}/${entry.name}`;
        await Deno.rename(sourcePath, destPath);
      }
      await Deno.remove(htmlSource);
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(`⚠️  Could not move HTML report: ${error}`);
    }
  }
}

async function cleanup(): Promise<void> {
  try {
    await Deno.remove(COV_TMP, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(`⚠️  Could not clean up ${COV_TMP}: ${error}`);
    }
  }
}

async function cleanupOldCoverage(): Promise<void> {
  try {
    await Deno.remove(COV_OUT, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(`⚠️  Could not clean up ${COV_OUT}: ${error}`);
    }
  }
  try {
    await Deno.remove(COV_TMP, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.warn(`⚠️  Could not clean up ${COV_TMP}: ${error}`);
    }
  }
}

async function main() {
  console.log("🧹 Cleaning up old coverage files...\n");
  await cleanupOldCoverage();

  console.log("🧪 Running tests with coverage...\n");

  const env: Record<string, string> = {
    NODE_ENV: "test",
  };

  if (isQuick) {
    env.TEST_SKIP_SEED = "1";
    env.TEST_SKIP_DB_SETUP = "1";
    console.log("⚡ Quick mode: Skipping seed and DB setup\n");
  }

  const testCmdArgs = [
    "test",
    `--coverage=${COV_TMP}`,
    "--allow-all",
    "--quiet",
    ...(isParallel ? ["--parallel"] : []),
    ...(testArgs.length > 0 ? testArgs : ["tests/"]),
  ];

  const testResult = await runCommand(
    "deno",
    testCmdArgs,
    env,
    `Running: deno ${testCmdArgs.join(" ")}`,
    true
  );

  if (!testResult.success) {
    console.error("\n❌ Tests failed");
    await cleanup();
    Deno.exit(1);
  }

  console.log("\n✅ Tests passed");
  console.log("\n📊 Generating coverage report...\n");

  await ensureDir(COV_OUT);

  const coverageArgs = [
    "coverage",
    COV_TMP,
    `--include=${INCLUDE_PATTERN}`,
    "--html",
    COV_OUT,
  ];

  const coverageResult = await runCommand(
    "deno",
    coverageArgs,
    undefined,
    `Generating: deno ${coverageArgs.join(" ")}`,
    true
  );

  if (!coverageResult.success) {
    console.error("\n❌ Coverage report generation failed");
    await cleanup();
    Deno.exit(1);
  }

  await moveHtmlIfNeeded();

  console.log(`\n✅ Coverage report generated at ${COV_OUT}/index.html`);
  console.log("\n📈 Coverage summary (filtered to modules/, libs/, router/, db/):\n");

  const summaryResult = await runCommand(
    "deno",
    ["coverage", COV_TMP, `--include=${INCLUDE_PATTERN}`],
    undefined,
    undefined,
    false
  );

  if (summaryResult.success && summaryResult.output) {
    console.log(summaryResult.output);
  }

  await cleanup();
  console.log("\n✨ Coverage report complete");
}

if (import.meta.main) {
  try {
    await main();
    Deno.exit(0);
  } catch (error) {
    console.error("\n❌ Coverage script failed:", error);
    await cleanup();
    Deno.exit(1);
  }
}

#!/usr/bin/env -S deno run --allow-all

/**
 * Migration Workflow Script
 * 
 * Provides interactive workflows for common migration tasks.
 * 
 * Usage:
 *   deno run -A ./scripts/migrations/workflow.ts
 */

import { Select, Confirm } from "@cliffy/prompt";

const workflows = {
  "fresh-start": {
    name: "🆕 Fresh Start (Clean + Generate + Reset + Migrate)",
    description: "Clean migration history and start fresh with a consolidated migration",
    steps: [
      { cmd: "deno", args: ["task", "db:clean-migrations"], desc: "Cleaning old migrations..." },
      { cmd: "deno", args: ["task", "db:generate"], desc: "Generating fresh migration..." },
      { cmd: "deno", args: ["task", "db:reset"], desc: "Resetting database..." },
      { cmd: "deno", args: ["task", "db:migrate"], desc: "Applying migration..." },
    ],
    warning: "⚠️  This will DELETE ALL DATA and clean migration history!",
  },
  "reset-and-migrate": {
    name: "🔄 Reset & Migrate (Reset + Install + Migrate)",
    description: "Reset database and reapply all existing migrations",
    steps: [
      { cmd: "deno", args: ["task", "db:reset"], desc: "Resetting database..." },
      { cmd: "deno", args: ["task", "db:migrate"], desc: "Applying migrations..." },
    ],
    warning: "⚠️  This will DELETE ALL DATA!",
  },
  "setup": {
    name: "⚙️  Initial Setup (Install + Prepare)",
    description: "First-time database setup",
    steps: [
      { cmd: "deno", args: ["task", "db:prepare"], desc: "Preparing database..." },
    ],
    warning: null,
  },
  "new-migration": {
    name: "➕ Create & Apply New Migration (Generate + Migrate)",
    description: "Generate and apply a new migration from schema changes",
    steps: [
      { cmd: "deno", args: ["task", "db:generate"], desc: "Generating migration..." },
      { cmd: "deno", args: ["task", "db:migrate"], desc: "Applying migration..." },
    ],
    warning: null,
  },
  "check-status": {
    name: "📊 Check Migration Status",
    description: "View applied migrations and database status",
    steps: [
      { cmd: "deno", args: ["task", "db:check-migrations"], desc: "Checking migrations..." },
    ],
    warning: null,
  },
};

async function runCommand(cmd: string, args: string[], description: string): Promise<boolean> {
  console.log(`\n${description}`);
  
  const command = new Deno.Command(cmd, {
    args,
    stdout: "inherit",
    stderr: "inherit",
  });

  const process = command.spawn();
  const { code } = await process.status;

  if (code !== 0) {
    console.error(`❌ Command failed with exit code ${code}`);
    return false;
  }

  return true;
}

async function executeWorkflow(workflowKey: string) {
  const workflow = workflows[workflowKey as keyof typeof workflows];
  
  console.log("\n" + "=".repeat(60));
  console.log(`  ${workflow.name}`);
  console.log("=".repeat(60));
  console.log(`\n${workflow.description}\n`);

  // Show warning if exists
  if (workflow.warning) {
    console.log(workflow.warning);
    const confirmed = await Confirm.prompt({
      message: "Are you sure you want to continue?",
      default: false,
    });

    if (!confirmed) {
      console.log("\n❌ Operation cancelled.");
      return;
    }
  }

  // Execute steps
  console.log("\n🚀 Starting workflow...");
  
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    console.log(`\n[${i + 1}/${workflow.steps.length}] ${step.desc}`);
    
    const success = await runCommand(step.cmd, step.args, "");
    
    if (!success) {
      console.error(`\n❌ Workflow failed at step ${i + 1}`);
      Deno.exit(1);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Workflow completed successfully!");
  console.log("=".repeat(60) + "\n");
}

async function main() {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║      AI-Edu Database Migration Workflow Manager       ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  const workflowKey = await Select.prompt({
    message: "Select a workflow:",
    options: Object.entries(workflows).map(([key, workflow]) => ({
      name: workflow.name,
      value: key,
    })),
  });

  await executeWorkflow(workflowKey);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "Prompt was cancelled") {
        console.log("\n❌ Operation cancelled by user.");
        Deno.exit(0);
      }
    }
    console.error("\n❌ Error:", error);
    Deno.exit(1);
  }
}


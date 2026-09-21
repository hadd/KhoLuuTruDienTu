export {}

const command = new Deno.Command("deno", {
    args: [
        "run",
        "--watch",
        "--allow-all",
        `./packages/sohoa-backend/main.ts`,
    ],
    stdout: "inherit",
    stderr: "inherit",
});

await command.spawn().status;
const command = new Deno.Command("deno", {
    args: [
        "run",
        "--watch",
        "--allow-all",
        `./src/main.ts`,
    ],
    stdout: "inherit",
    stderr: "inherit",
});

await command.spawn().status;
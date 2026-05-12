export function parseCronExpression(cron: string): { hour: number; minute: number } {
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) {
        throw new Error(`Invalid cron expression: ${cron}`);
    }
    const minute = parseInt(parts[0], 10);
    const hour = parseInt(parts[1], 10);
    if (isNaN(minute) || isNaN(hour)) {
        throw new Error(`Invalid cron expression: ${cron}`);
    }
    if (minute < 0 || minute > 59) {
        throw new Error(`Invalid minute value in cron expression: ${cron}. Must be 0-59`);
    }
    if (hour < 0 || hour > 23) {
        throw new Error(`Invalid hour value in cron expression: ${cron}. Must be 0-23`);
    }
    return { hour, minute };
}

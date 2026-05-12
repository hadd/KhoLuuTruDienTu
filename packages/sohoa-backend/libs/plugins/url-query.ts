import { Elysia } from "elysia";

function parseQueryString(string: string) {
    if (string === "" || string == null) return {};
    if (string.charAt(0) === "?") string = string.slice(1);

    const entries = string.split("&");
    const counters: any = {};
    const data: any = {};
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i].split("=");
        const key = decodeURIComponent(entry[0]);
        let value: any = entry.length === 2 ? decodeURIComponent(entry[1]) : "";

        if (value === "true") value = true;
        else if (value === "false") value = false;

        const levels = key.split(/\]\[?|\[/);
        let cursor: any = data;
        if (key.indexOf("[") > -1) levels.pop();
        for (let j = 0; j < levels.length; j++) {
            let level: any = levels[j];
            const nextLevel = levels[j + 1];
            const isNumber = nextLevel == "" || !isNaN(parseInt(nextLevel, 10));
            if (level === "") {
                const key = levels.slice(0, j).join();
                if (counters[key] == null) {
                    counters[key] = Array.isArray(cursor) ? cursor.length : 0;
                }
                level = counters[key]++;
            } // Disallow direct prototype pollution
            else if (level === "__proto__") break;
            if (j === levels.length - 1) cursor[level] = value;
            else {
                // Read own properties exclusively to disallow indirect
                // prototype pollution
                let desc: any = Object.getOwnPropertyDescriptor(
                    cursor,
                    level,
                );
                if (desc != null) desc = desc.value;
                if (desc == null) cursor[level] = desc = isNumber ? [] : {};
                cursor = desc;
            }
        }
    }
    return data;
}


export const plUrlQuery = new Elysia()
    .derive<{ urlQuery: any }>(({ request }) => {
        const url = request.url;
        const queryString = url.split("?")[1] || "";
        return { urlQuery: parseQueryString(queryString) };
    }).as("scoped");

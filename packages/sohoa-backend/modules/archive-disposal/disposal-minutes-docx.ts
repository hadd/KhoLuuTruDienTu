import {
    fillDocxBlankRuns,
    fillDocxBlocks,
    loadAssetDocxBlocks,
    renderTipTapIntoAssetDocx,
} from "./disposal-docx-blocks.ts";
import type { TipTapDocument } from "./disposal-document-tiptap.ts";
import type { CouncilMinutesMemberEvaluation, CouncilMinutesOutcomeRow } from "./disposal-minutes-pdf.ts";

function decisionLabel(decision: string | null): string {
    if (decision === "DESTROY") return "Đồng ý hủy";
    if (decision === "KEEP") return "Không hủy";
    return "Chưa kết luận";
}

function splitDateParts(isoDate: string): { day: string; month: string; year: string } {
    const [year = "", month = "", day = ""] = isoDate.slice(0, 10).split("-");
    return { day: day.replace(/^0/, "") || day, month: month.replace(/^0/, "") || month, year };
}

function findMemberByRole(
    members: Array<{ fullName: string; positionLabel: string }>,
    roleHint: string,
): string {
    const found = members.find((m) =>
        m.positionLabel.toLowerCase().includes(roleHint.toLowerCase())
    );
    return found?.fullName ?? "……";
}

export function mapCouncilMinutesDocxData(input: {
    councilCode: string;
    catalogCode: string;
    catalogName: string;
    meetingDate: Date;
    members: Array<{ fullName: string; positionLabel: string; excusedAbsent: boolean }>;
    outcomes: CouncilMinutesOutcomeRow[];
    evaluations: CouncilMinutesMemberEvaluation[];
    summaryLine: string;
}): Record<string, string> {
    const meetingDate = input.meetingDate.toISOString().slice(0, 10);
    const memberLines = input.members.map((m) => {
        const absent = m.excusedAbsent ? " (vắng mặt có lý do)" : "";
        return `• ${m.fullName} — ${m.positionLabel}${absent}`;
    }).join("\n");

    const outcomeLines = input.outcomes.map((row) => {
        const dissent = row.hasDissent ? " — có ý kiến khác biệt" : "";
        const chair = row.chairReason?.trim() ? `\n  Lý do Chủ tịch: ${row.chairReason.trim()}` : "";
        return `• ${row.label}: ${decisionLabel(row.decision)}${dissent}${chair}`;
    }).join("\n");

    const evaluationLines = input.evaluations.map((ev) =>
        `• ${ev.memberName} (${ev.positionLabel}) — ${ev.itemLabel}: ${decisionLabel(ev.decision)}. ${ev.note}`
    ).join("\n");

    const body = [
        `Mã Hội đồng: ${input.councilCode}`,
        `Danh mục: ${input.catalogCode} — ${input.catalogName}`,
        `Ngày họp: ${meetingDate}`,
        "",
        "Thành phần Hội đồng:",
        memberLines,
        "",
        input.summaryLine,
        "",
        "Kết luận theo từng hồ sơ/tài liệu:",
        outcomeLines,
        "",
        "Ý kiến thành viên:",
        evaluationLines,
    ].join("\n");

    return {
        councilCode: input.councilCode,
        catalogCode: input.catalogCode,
        catalogName: input.catalogName,
        meetingDate,
        memberList: memberLines,
        summaryLine: input.summaryLine,
        outcomeList: outcomeLines,
        evaluationList: evaluationLines,
        body,
    };
}

export function mapDestructionMinutesDocxData(input: {
    councilCode: string;
    catalogCode: string;
    catalogName: string;
    meetingDate: Date;
    members: Array<{ fullName: string; positionLabel: string; excusedAbsent: boolean }>;
    outcomes: CouncilMinutesOutcomeRow[];
    destructionSummary: string;
}): Record<string, string> {
    const meetingDate = input.meetingDate.toISOString().slice(0, 10);
    const destroyItems = input.outcomes
        .filter((o) => o.decision === "DESTROY")
        .map((o) => `• ${o.label}`)
        .join("\n");
    const attendeeLines = input.members
        .filter((m) => !m.excusedAbsent)
        .map((m) => `• ${m.fullName} — ${m.positionLabel}`)
        .join("\n");

    const body = [
        `Mã Hội đồng: ${input.councilCode}`,
        `Danh mục: ${input.catalogCode} — ${input.catalogName}`,
        `Ngày: ${meetingDate}`,
        "",
        input.destructionSummary,
        "",
        "Danh sách hồ sơ/tài liệu đề nghị hủy:",
        destroyItems,
        "",
        "Thành phần tham dự:",
        attendeeLines,
    ].join("\n");

    return {
        councilCode: input.councilCode,
        catalogCode: input.catalogCode,
        catalogName: input.catalogName,
        meetingDate,
        destructionSummary: input.destructionSummary,
        destroyList: destroyItems,
        attendeeList: attendeeLines,
        body,
    };
}

export async function buildCouncilMinutesTipTapFromAsset(input: {
    councilCode: string;
    catalogCode: string;
    catalogName: string;
    meetingDate: Date;
    members: Array<{ fullName: string; positionLabel: string; excusedAbsent: boolean }>;
    outcomes: CouncilMinutesOutcomeRow[];
    evaluations: CouncilMinutesMemberEvaluation[];
    summaryLine: string;
    location?: string;
}): Promise<TipTapDocument> {
    const { day, month, year } = splitDateParts(input.meetingDate.toISOString().slice(0, 10));
    const presentMembers = input.members.filter((m) => !m.excusedAbsent);
    const memberNames = presentMembers
        .map((m) => `${m.fullName} (${m.positionLabel})`)
        .join("; ");
    const chair = findMemberByRole(input.members, "Chủ tịch");
    const secretary = findMemberByRole(input.members, "Thư ký");
    const keepLabels = input.outcomes
        .filter((o) => o.decision === "KEEP")
        .map((o) => o.label)
        .join(", ") || "Không có";
    const opinions = input.evaluations.slice(0, 3).map((ev) =>
        `${ev.memberName}: ${ev.itemLabel} — ${decisionLabel(ev.decision)}${ev.note ? `. ${ev.note}` : ""}`
    );
    while (opinions.length < 3) opinions.push(input.summaryLine);
    const agreeCount = `${presentMembers.length}/${input.members.length}`;
    const fondLabel = `${input.catalogCode} — ${input.catalogName}`;
    const location = input.location?.trim() || "Trụ sở đơn vị";

    const blocks = await loadAssetDocxBlocks("MINUTES_COUNCIL");

    return fillDocxBlocks(blocks, (text) => {
        if (/^Hà Nội,\s*ngày/.test(text)) {
            return `Hà Nội, ngày ${day} tháng ${month} năm ${year}`;
        }
        if (text.startsWith("Hôm nay, vào hồi")) {
            const queue = ["…", "…", day, month, year];
            return fillDocxBlankRuns(text, queue);
        }
        if (text.startsWith("Tại ")) {
            return fillDocxBlankRuns(text, [location]);
        }
        if (text.includes("ghi rõ họ tên các thành viên")) {
            return fillDocxBlankRuns(text, [memberNames || "……"]);
        }
        if (text.startsWith("Chủ tọa:")) {
            return fillDocxBlankRuns(text, [chair]);
        }
        if (text.startsWith("Thư ký:")) {
            return fillDocxBlankRuns(text, [secretary]);
        }
        if (text.startsWith("Nội dung họp:")) {
            return fillDocxBlankRuns(text, [fondLabel]);
        }
        if (text.startsWith("Sau khi nghiên cứu")) {
            return fillDocxBlankRuns(text, [fondLabel]);
        }
        if (text.startsWith("1. ") && text.includes("……")) {
            return fillDocxBlankRuns(text, [opinions[0]!]);
        }
        if (text.startsWith("2. ") && text.includes("……")) {
            return fillDocxBlankRuns(text, [opinions[1]!]);
        }
        if (text.startsWith("3. ") && text.includes("……")) {
            return fillDocxBlankRuns(text, [opinions[2]!]);
        }
        if (text.includes("Đề nghị giữ lại")) {
            return fillDocxBlankRuns(text, [keepLabels]);
        }
        if (text.includes("ý kiến nhất trí")) {
            return fillDocxBlankRuns(text, [agreeCount.split("/")[0]!, agreeCount.split("/")[1]!]);
        }
        if (text.startsWith("Cuộc họp kết thúc")) {
            return fillDocxBlankRuns(text, ["…", "…"]);
        }
        return text;
    });
}

export async function buildDestructionMinutesTipTapFromAsset(input: {
    councilCode: string;
    catalogCode: string;
    catalogName: string;
    meetingDate: Date;
    members: Array<{ fullName: string; positionLabel: string; excusedAbsent: boolean }>;
    outcomes: CouncilMinutesOutcomeRow[];
    destructionSummary: string;
    location?: string;
    destroyCount: number;
}): Promise<TipTapDocument> {
    const { day, month, year } = splitDateParts(input.meetingDate.toISOString().slice(0, 10));
    const present = input.members.filter((m) => !m.excusedAbsent);
    const location = input.location?.trim() || "Trụ sở đơn vị";
    const memberSlots = [0, 1, 2, 3].map((i) => {
        const m = present[i];
        return m
            ? { name: m.fullName, role: m.positionLabel, org: "Đơn vị" }
            : { name: "……", role: "……", org: "……" };
    });

    const blocks = await loadAssetDocxBlocks("MINUTES_DESTRUCTION");

    return fillDocxBlocks(blocks, (text) => {
        if (text.startsWith("Số:")) {
            return fillDocxBlankRuns(text, [input.councilCode]);
        }
        if (/ngày.*tháng.*năm/.test(text) && text.includes("……")) {
            return fillDocxBlankRuns(text, [location, day, month, year]);
        }
        if (text.startsWith("Căn cứ Quyết định")) {
            return fillDocxBlankRuns(text, ["……", day, month, year, "……"]);
        }
        if (text.startsWith("Vào hồi")) {
            return fillDocxBlankRuns(text, ["…", "…", day, month, year, location]);
        }
        if (/^\d+\.\s*Ông \(bà\)/.test(text)) {
            const idx = Number(text[0]) - 1;
            const slot = memberSlots[idx] ?? memberSlots[0]!;
            return fillDocxBlankRuns(text, [slot.name, slot.role, slot.org]);
        }
        if (text.includes("Tài liệu thuộc Phông")) {
            return fillDocxBlankRuns(text, [`${input.catalogCode} — ${input.catalogName}`]);
        }
        if (text.startsWith("- Số lượng:")) {
            return fillDocxBlankRuns(text, [String(input.destroyCount)]);
        }
        if (text.includes("Hình thức hủy")) {
            return fillDocxBlankRuns(text, ["máy cắt giấy"]);
        }
        if (text.startsWith("Việc hủy hồ sơ")) {
            return fillDocxBlankRuns(text, ["…", "…"]);
        }
        return text;
    });
}

export async function buildCouncilMinutesDocxFromData(
    input: Parameters<typeof mapCouncilMinutesDocxData>[0],
) {
    const tipTap = await buildCouncilMinutesTipTapFromAsset(input);
    const docx = await renderTipTapIntoAssetDocx("MINUTES_COUNCIL", tipTap);
    return { docx, tipTap };
}

export async function buildDestructionMinutesDocxFromData(
    input: Parameters<typeof mapDestructionMinutesDocxData>[0] & { destroyCount?: number },
) {
    const destroyCount = input.destroyCount ??
        input.outcomes.filter((o) => o.decision === "DESTROY").length;
    const tipTap = await buildDestructionMinutesTipTapFromAsset({
        ...input,
        destroyCount,
    });
    const docx = await renderTipTapIntoAssetDocx("MINUTES_DESTRUCTION", tipTap);
    return { docx, tipTap };
}

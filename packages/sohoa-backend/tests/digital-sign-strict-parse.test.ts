// Strict structural validation using pdfjs-dist (much closer to Chrome/pdfium
// behaviour than pdf-lib, which tolerates broken xref chains via brute-force
// object scanning and can silently "succeed" on structurally broken files).
import forge from "npm:node-forge";
import { PDFDocument, rgb } from "pdf-lib";
import * as pdfjsLib from "npm:pdfjs-dist@4.0.379/legacy/build/pdf.mjs";
import {
    preparePdfForSigning,
    createSignedPdfFromPrepared,
} from "../modules/digital-sign/digital-sign-pdf-utils.ts";

async function buildRealisticPdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    // 4 pages like a real scanned multi-page document, each with drawn content
    // (simulating a raster scan without needing an actual JPEG asset).
    for (let i = 0; i < 4; i++) {
        const page = doc.addPage([595, 842]); // A4
        page.drawRectangle({
            x: 20,
            y: 20,
            width: 555,
            height: 800,
            color: rgb(0.9, 0.9, 0.9),
        });
        page.drawText(`Trang scan so ${i + 1}`, { x: 50, y: 780, size: 20 });
        for (let l = 0; l < 30; l++) {
            page.drawLine({
                start: { x: 50, y: 700 - l * 20 },
                end: { x: 500, y: 700 - l * 20 },
                thickness: 1,
                color: rgb(0.3, 0.3, 0.3),
            });
        }
    }
    // Default save (object streams ON) mimics typical scanner/OCR pipeline output.
    return await doc.save();
}

async function renderCheck(bytes: Uint8Array, label: string) {
    // pdf.js may transfer/detach the underlying ArrayBuffer of `data` after
    // use; pass a copy so callers can safely reuse the original bytes.
    const loadingTask = (pdfjsLib as any).getDocument({
        data: bytes.slice(),
        useSystemFonts: true,
        disableFontFace: true,
        isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    console.log(`[${label}] numPages=${pdf.numPages}`);
    let totalOps = 0;
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const opList = await page.getOperatorList();
        totalOps += opList.fnArray.length;
        console.log(`[${label}] page ${i} ops=${opList.fnArray.length}`);
    }
    await pdf.destroy();
    if (totalOps === 0) {
        throw new Error(`${label}: no rendering operators found — page(s) are blank`);
    }
    return totalOps;
}

Deno.test("strict pdf.js parse: prepared PDF is not structurally broken", async () => {
    const original = await buildRealisticPdf();
    await renderCheck(original, "original");

    const prepared = await preparePdfForSigning(original, {
        subject: "CN=Test Signer",
        visualSignature: {
            pageNumber: 1,
            xRatio: 50,
            yRatio: 70,
            widthPx: 120,
            heightPx: 40,
            reason: "test",
        },
    });

    const preparedOps = await renderCheck(prepared.preparedPdf, "prepared");
    console.log("prepared total ops:", preparedOps);
});

Deno.test("strict pdf.js parse: fully signed PDF is not structurally broken", async () => {
    const original = await buildRealisticPdf();

    const keys = forge.pki.rsa.generateKeyPair(1024);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = "01";
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    const attrs = [
        { name: "commonName", value: "Test Signer" },
        { name: "countryName", value: "VN" },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());
    const certDer = forge.util.encode64(
        forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes(),
    );

    const prepared = await preparePdfForSigning(original, {
        subject: "CN=Test Signer",
        visualSignature: {
            pageNumber: 2,
            xRatio: 60,
            yRatio: 20,
            widthPx: 150,
            heightPx: 50,
            reason: "test",
        },
    });

    const hashBytes = forge.util.decode64(prepared.hashBase64);
    const fakeMd = {
        algorithm: "sha256",
        digest: () => forge.util.createBuffer(hashBytes),
        digestLength: 32,
    };
    const signatureBase64 = forge.util.encode64(
        keys.privateKey.sign(fakeMd as unknown as forge.md.MessageDigest),
    );

    const signed = createSignedPdfFromPrepared({
        preparedPdf: prepared.preparedPdf,
        signatureBase64,
        certificateBase64: certDer,
        authAttrsDerBase64: prepared.authAttrsDerBase64,
        contentsOffset: prepared.contentsOffset,
        contentsLength: prepared.contentsLength,
    });

    await Deno.mkdir(new URL("./_artifacts/", import.meta.url), { recursive: true });
    await Deno.writeFile(
        new URL("./_artifacts/strict-signed-multi-page.pdf", import.meta.url),
        signed,
    );

    const signedOps = await renderCheck(signed, "signed");
    console.log("signed total ops:", signedOps);
});

/**
 * Round-trip test: prepare PDF → SignHash with local RSA → embed CMS → verify.
 * Simulates USB token SignHash without requiring hardware.
 * Also writes a sample signed PDF for manual Foxit/Adobe inspection.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import forge from "npm:node-forge";
import { PDFDocument, rgb } from "pdf-lib";
import {
    preparePdfForSigning,
    createSignedPdfFromPrepared,
    verifySignedPdf,
} from "../modules/digital-sign/digital-sign-pdf-utils.ts";
import { toSignedPdfKey } from "../modules/dossier/dossier-path-utils.ts";

async function makeSamplePdf(): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    page.drawText("Sohoa digital sign test", { x: 50, y: 750, size: 18 });
    page.drawRectangle({
        x: 50,
        y: 700,
        width: 200,
        height: 40,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
    });
    return await doc.save({ useObjectStreams: false });
}

function generateSelfSignedCert(): {
    privateKey: forge.pki.rsa.PrivateKey;
    certDerBase64: string;
} {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = "01";
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    const attrs = [
        { name: "commonName", value: "CONG TY TEST SOHOA" },
        { name: "countryName", value: "VN" },
        { name: "organizationName", value: "Sohoa Test" },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
        { name: "basicConstraints", cA: false },
        { name: "keyUsage", digitalSignature: true, nonRepudiation: true },
    ]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const asn1Cert = forge.pki.certificateToAsn1(cert);
    const der = forge.asn1.toDer(asn1Cert).getBytes();
    return {
        privateKey: keys.privateKey,
        certDerBase64: forge.util.encode64(der),
    };
}

Deno.test("toSignedPdfKey mirrors raw/ to signed/", () => {
    assertEquals(
        toSignedPdfKey("raw/PROJECT_A/ho_so_001/van_ban.pdf"),
        "signed/PROJECT_A/ho_so_001/van_ban.pdf",
    );
    assertEquals(toSignedPdfKey("imports/a.pdf"), null);
});

Deno.test("PAdES prepare → SignHash → embed → verify roundtrip", async () => {
    const pdf = await makeSamplePdf();
    const { privateKey, certDerBase64 } = generateSelfSignedCert();

    const prepared = await preparePdfForSigning(pdf, {
        subject: "CN=CONG TY TEST SOHOA, C=VN",
        visualSignature: {
            pageNumber: 1,
            xRatio: 60,
            yRatio: 80,
            widthPx: 280,
            heightPx: 70,
            reason: "Test signature",
            location: "Hanoi",
        },
    });

    assert(prepared.hashBase64.length > 0);
    assert(prepared.contentsLength > 0);
    assertEquals(prepared.byteRange[0], 0);

    const hashBytes = forge.util.decode64(prepared.hashBase64);
    const fakeMd = {
        algorithm: "sha256",
        digest: () => forge.util.createBuffer(hashBytes),
        digestLength: 32,
    };
    const sigBytes = privateKey.sign(fakeMd as unknown as forge.md.MessageDigest);
    const signatureBase64 = forge.util.encode64(sigBytes);

    const signed = createSignedPdfFromPrepared({
        preparedPdf: prepared.preparedPdf,
        signatureBase64,
        certificateBase64: certDerBase64,
        authAttrsDerBase64: prepared.authAttrsDerBase64,
        contentsOffset: prepared.contentsOffset,
        contentsLength: prepared.contentsLength,
    });

    assert(signed.length >= prepared.preparedPdf.length);

    const verification = await verifySignedPdf(signed);
    assertEquals(verification.valid, true, verification.reason ?? "verify failed");
    assert(Boolean(verification.certificateSubject));

    const outDir = new URL("./_artifacts/", import.meta.url);
    await Deno.mkdir(outDir, { recursive: true });
    const outPath = new URL("./_artifacts/pades-roundtrip-signed.pdf", import.meta.url);
    await Deno.writeFile(outPath, signed);
});

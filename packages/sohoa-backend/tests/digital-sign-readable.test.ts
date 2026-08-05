import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import forge from "npm:node-forge";
import { PDFDocument } from "pdf-lib";
import {
    preparePdfForSigning,
    createSignedPdfFromPrepared,
    verifySignedPdf,
} from "../modules/digital-sign/digital-sign-pdf-utils.ts";

Deno.test("signed PDF must remain readable (not blank)", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 400]);
    page.drawText("VISIBLE CONTENT BEFORE SIGN", { x: 40, y: 300, size: 16 });
    const original = await doc.save({ useObjectStreams: false });

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
            pageNumber: 1,
            xRatio: 50,
            yRatio: 70,
            widthPx: 120,
            heightPx: 40,
            reason: "test",
        },
    });

    // Must load without throwing and keep page content
    const preparedDoc = await PDFDocument.load(prepared.preparedPdf, {
        ignoreEncryption: true,
    });
    assertEquals(preparedDoc.getPageCount(), 1);

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

    const signedDoc = await PDFDocument.load(signed, { ignoreEncryption: true });
    assertEquals(signedDoc.getPageCount(), 1);

    const verification = await verifySignedPdf(signed);
    assertEquals(verification.valid, true, verification.reason);

    await Deno.mkdir(new URL("./_artifacts/", import.meta.url), { recursive: true });
    await Deno.writeFile(
        new URL("./_artifacts/readable-after-sign.pdf", import.meta.url),
        signed,
    );
});

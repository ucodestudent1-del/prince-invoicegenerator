import { InvoiceTemplate } from "@/components/invoice-template";
import { DocumentTemplate } from "@/components/document-template";
import type { EntityType } from "@/components/document-template";
import { PAPER_SIZES, type PaperSize, resolvePaperSize } from "@/lib/pdf-constants";

let cachedRenderToString: ((node: any) => string) | null = null;

export interface PdfGenerationOptions {
  paperSize?: PaperSize;
  locale?: string;
}

export async function generateInvoicePdf(
  invoice: any,
  org: any,
  options: PdfGenerationOptions = {}
): Promise<Buffer> {
  const { paperSize = "A4", locale = "en" } = options;
  const resolvedSize = resolvePaperSize(paperSize);
  if (!cachedRenderToString) {
    const { renderToString } = await import("react-dom/server");
    cachedRenderToString = renderToString;
  }
  const html = wrapHtmlForPdf(
    cachedRenderToString(InvoiceTemplate({ invoice, org, paperSize: resolvedSize, locale })),
    PAPER_SIZES[resolvedSize]
  );
  return renderPdf(html, PAPER_SIZES[resolvedSize]);
}

export async function generateDocumentPdf(
  entityType: EntityType,
  doc: any,
  org: any,
  options: PdfGenerationOptions = {}
): Promise<Buffer> {
  const { paperSize = "A4", locale = "en" } = options;
  const resolvedSize = resolvePaperSize(paperSize);
  if (!cachedRenderToString) {
    const { renderToString } = await import("react-dom/server");
    cachedRenderToString = renderToString;
  }
  const html = wrapHtmlForPdf(
    cachedRenderToString(DocumentTemplate({ entityType, doc, org, paperSize: resolvedSize, locale })),
    PAPER_SIZES[resolvedSize]
  );
  return renderPdf(html, PAPER_SIZES[resolvedSize]);
}

async function renderPdf(
  html: string,
  paper: { width: string; height: string }
): Promise<Buffer> {
  let puppeteer: any;
  try {
    puppeteer = await import(/* webpackIgnore: true */ "puppeteer");
  } catch {
    throw new Error(
      "Puppeteer is not installed. Run `npm install puppeteer` to enable PDF generation."
    );
  }

  const launch = puppeteer?.["default"]?.launch ?? puppeteer?.["launch"];
  if (typeof launch !== "function") {
    throw new Error(
      "Puppeteer is installed but its launcher could not be resolved."
    );
  }

  const executablePath = process["env"]["PUPPETEER_EXECUTABLE_PATH"] || undefined;

  const puppeteerInstance = puppeteer["default"] ?? puppeteer;

  let browser: any;
  try {
    browser = await launch.call(puppeteerInstance, {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
      executablePath,
    });
  } catch (err: any) {
    throw new Error(
      `Failed to launch Chromium: ${err?.["message"] ?? err}. Ensure a Chromium build is available (set PUPPETEER_EXECUTABLE_PATH or install @puppeteer/browsers).`
    );
  }

  try {
    const page = await browser["newPage"]();

    await page["setContent"](html, {
      waitUntil: "networkidle0",
      timeout: 60000,
    });

    const pdfBuffer = await page["pdf"]({
      width: paper["width"],
      height: paper["height"],
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      displayHeaderFooter: false,
    });

    return Buffer["from"](pdfBuffer);
  } finally {
    await browser["close"]().catch(() => {});
  }
}

function wrapHtmlForPdf(bodyHtml: string, paper: { width: string; height: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    * , *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      width: ${paper["width"]};
      height: ${paper["height"]};
      margin: 0;
      padding: 0;
      background: white;
      color: black;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @page {
      size: ${paper["width"]} ${paper["height"]};
      margin: 0;
    }

    table { border-collapse: collapse; }

    .type-badge {
      background-color: var(--invoice-accent, #3b82f6);
      color: white;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

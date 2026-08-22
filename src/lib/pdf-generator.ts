import { InvoiceTemplate } from "@/components/invoice-template";

const PAPER_SIZES = {
  A4: { width: "210mm", height: "297mm" },
  Letter: { width: "215.9mm", height: "279.4mm" },
  Legal: { width: "215.9mm", height: "355.6mm" },
} as const;

export interface PdfGenerationOptions {
  paperSize?: "A4" | "Letter" | "Legal";
  locale?: string;
}

export async function generateInvoicePdf(
  invoice: any,
  org: any,
  options: PdfGenerationOptions = {}
): Promise<Buffer> {
  const { paperSize = "A4", locale = "en" } = options;
  const paper = PAPER_SIZES[paperSize];

  // Dynamic import to avoid Next.js bundling restrictions on react-dom/server
  const { renderToString } = await import("react-dom/server");

  // Render the shared template to HTML string
  const templateHtml = renderToString(
    InvoiceTemplate({ invoice, org, paperSize, locale })
  );

  // Wrap with proper HTML structure, CSS, and meta tags
  const fullHtml = wrapHtmlForPdf(templateHtml, paper);

  // Dynamic import to avoid bundling issues - puppeteer is optional
  let puppeteer: any;
  try {
    // Use require.resolve to check if puppeteer is available without bundling it
    if (typeof require !== "undefined") {
      require.resolve("puppeteer");
      puppeteer = await import("puppeteer");
    }
  } catch (err) {
    throw new Error(
      "Puppeteer is not installed. Run `npm install puppeteer` to enable PDF generation."
    );
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--single-process",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();

    // Set content and wait for rendering to complete
    await page.setContent(fullHtml, {
      waitUntil: ["networkidle0", "domcontentloaded"],
      timeout: 30000,
    });

    // Generate PDF with print-optimized settings
    const pdfBuffer = await page.pdf({
      width: paper.width,
      height: paper.height,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      scale: 2, // Higher scale for better quality
      displayHeaderFooter: false,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function wrapHtmlForPdf(bodyHtml: string, paper: { width: string; height: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice</title>
  <style>
    /* Reset */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      width: ${paper.width};
      height: ${paper.height};
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

    /* Page setup */
    @page {
      size: ${paper.width} ${paper.height};
      margin: 0;
    }

    /* Utility */
    table { border-collapse: collapse; }

    /* Print colors */
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

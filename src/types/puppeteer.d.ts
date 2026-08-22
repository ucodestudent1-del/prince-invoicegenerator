declare module "puppeteer" {
  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export interface Page {
    setContent(html: string, options?: { waitUntil?: string[]; timeout?: number }): Promise<void>;
    pdf(options?: {
      width?: string;
      height?: string;
      printBackground?: boolean;
      preferCSSPageSize?: boolean;
      margin?: { top?: string; right?: string; bottom?: string; left?: string };
      scale?: number;
      displayHeaderFooter?: boolean;
    }): Promise<Uint8Array>;
  }

  export interface PuppeteerLaunchOptions {
    headless?: boolean;
    args?: string[];
  }

  export function launch(options?: PuppeteerLaunchOptions): Promise<Browser>;
}

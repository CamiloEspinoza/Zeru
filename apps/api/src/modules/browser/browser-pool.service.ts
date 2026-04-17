import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';

@Injectable()
export class BrowserPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name);
  private browser: any; // puppeteer.Browser
  private availablePages: any[] = []; // puppeteer.Page[]
  private readonly maxPages = 5;

  async onModuleInit() {
    try {
      const puppeteer = await import('puppeteer');
      this.browser = await puppeteer.default.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });
      this.logger.log('Puppeteer browser pool initialized');
    } catch (error) {
      this.logger.warn(
        `Puppeteer not available: ${error.message}. PDF generation will be disabled.`,
      );
    }
  }

  async acquire(): Promise<any> {
    if (!this.browser) {
      throw new Error('Puppeteer browser not initialized');
    }
    if (this.availablePages.length > 0) {
      return this.availablePages.pop()!;
    }
    return await this.browser.newPage();
  }

  async release(page: any): Promise<void> {
    if (this.availablePages.length < this.maxPages) {
      try {
        await page.setContent('');
        this.availablePages.push(page);
      } catch {
        try {
          await page.close();
        } catch {
          // ignore
        }
      }
    } else {
      try {
        await page.close();
      } catch {
        // ignore
      }
    }
  }

  isAvailable(): boolean {
    return !!this.browser;
  }

  async onModuleDestroy() {
    for (const page of this.availablePages) {
      try {
        await page.close();
      } catch {
        // ignore
      }
    }
    if (this.browser) {
      await this.browser.close();
      this.logger.log('Puppeteer browser pool destroyed');
    }
  }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class Pdf417Service {
  async generate(tedXml: string): Promise<string> {
    const bwipjs = await import('bwip-js');
    const pngBuffer = await bwipjs.toBuffer({
      bcid: 'pdf417',
      text: tedXml,
      scale: 2,
      columns: 10,
      eclevel: 5,
      encoding: 'latin1',
    });
    return `data:image/png;base64,${pngBuffer.toString('base64')}`;
  }
}

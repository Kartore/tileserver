import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { cors } from 'hono/cors';
import opentype from 'opentype.js';
import * as z from 'zod';
import type { Bindings } from '~/index';
import { generateFontProtocolBuf } from '~/utils/sdf';
import Protobuf from 'pbf';
import { readGlyphs } from '~/proto/glyphs';

export const fonts = new Hono<{
  Bindings: Bindings;
}>();

fonts.use('*', cors());
/*
fonts.use(
  '*',
  cache({
    cacheName: 'fonts',
  })
);
*/

fonts.get(
  '/:fontId/:range{\\d+-\\d+.pbf}',
  zValidator(
    'param',
    z.object({
      fontId: z.string(),
      range: z.preprocess(
        (value) => {
          const [range, ext] = (value as string).split('.');
          const [from, to] = range.split('-');
          if (ext !== 'pbf') {
            throw new Error('Invalid ext');
          }
          if (Number.isNaN(Number(from))) {
            throw new Error('Invalid from');
          }
          if (Number.isNaN(Number(to))) {
            throw new Error('Invalid to');
          }
          return {
            from: Number(from),
            to: Number(to),
          };
        },
        z.object({
          from: z.number(),
          to: z.number(),
        })
      ),
    })
  ),
  async (c) => {
    const {
      fontId,
      range: { from, to },
    } = c.req.valid('param');
    const key = `/fonts/${fontId}`;
    const fontDataResponse = await c.env.PM_TILES_BUCKET.get(key);
    if (!fontDataResponse) {
      return c.notFound();
    }
    const font = opentype.parse(await fontDataResponse.arrayBuffer());
    const fontResponseBuffer = await generateFontProtocolBuf(font, from, to);

    return c.newResponse(fontResponseBuffer, 200, {
      'Content-Type': 'application/x-protobuf',
    });
  }
);

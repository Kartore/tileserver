import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { cors } from 'hono/cors';
import * as z from 'zod';
import type { Bindings } from '~/index';
import { generateTileJSONFromPMTiles, getTileFromPMTiles, openPMTiles } from '~/utils/pmtiles';

export const tiles = new Hono<{
  Bindings: Bindings;
}>();

tiles.use('*', cors());

tiles.use(
  '*',
  cache({
    cacheName: 'tiles',
  })
);

tiles.get('/:id/tile.json', zValidator('param', z.object({ id: z.string() })), async (c) => {
  const { id } = c.req.valid('param');
  const key = id === 'osm' ? 'osm/planet.pmtiles' : id;
  const url = new URL(c.req.url);
  const pmtiles = openPMTiles(c.env.PM_TILES_BUCKET, key);
  const tileJSON = await generateTileJSONFromPMTiles(pmtiles, url.origin, id);
  return c.json(tileJSON, 200, {
    'Cache-Control': 'public, s-max-age=86400',
  });
});

tiles.get(
  '/:id/:z{\\d+}/:x{\\d+}/:yWithExtension{\\d+.\\w+}',
  zValidator(
    'param',
    z.object({
      id: z.string(),
      z: z.preprocess((v) => Number(v), z.number()),
      x: z.preprocess((v) => Number(v), z.number()),
      yWithExtension: z.preprocess(
        (v) => {
          const [y, extension] = (v as string).split('.');
          if (Number.isNaN(Number(y))) {
            throw new Error('Invalid y');
          }
          return {
            y: Number(y),
            extension,
          };
        },
        z.object({
          y: z.number(),
          extension: z.string(),
        })
      ),
    })
  ),
  async (c) => {
    const {
      id,
      z,
      x,
      yWithExtension: { y, extension },
    } = c.req.valid('param');

    const key = id === 'osm' ? 'osm/planet.pmtiles' : id;
    if (z < 0 || x < 0 || y < 0 || x >= Math.pow(2, z) || y >= Math.pow(2, z)) {
      return c.text('Out of range', 400);
    }
    const pmtiles = openPMTiles(c.env.PM_TILES_BUCKET, key);
    const tile = await getTileFromPMTiles(pmtiles, z, x, y, extension);
    return c.newResponse(tile.body, 200, {
      ...tile.headers,
      'Cache-Control': 'public, s-max-age=86400',
    });
  }
);

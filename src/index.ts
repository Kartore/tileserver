import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as z from 'zod';
import { fonts } from '~/routes/fonts';
import { tiles } from '~/routes/tiles';

export type Bindings = {
  PM_TILES_BUCKET: R2Bucket;
};

const app = new Hono<{
  Bindings: Bindings;
}>();

app.use('*', cors());

app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.route('/tiles', tiles);
app.route('/fonts', fonts);

app.get('/fonts.json', async (c) => {
  const fontDataResponse = await c.env.PM_TILES_BUCKET.list({
    prefix: '/fonts/',
  });

  return c.json(
    fontDataResponse.objects.map((value) => {
      return value.key.replace('/fonts/', '');
    })
  );
});

export default app;

/**
 * https://github.com/maptiler/tileserver-gl/blob/master/src/pmtiles_adapter.js
 * https://github.com/protomaps/PMTiles/blob/main/serverless/cloudflare/src/index.ts
 */
import type { Header, Source } from 'pmtiles';
import { ResolvedValueCache } from 'pmtiles';
import { Compression } from 'pmtiles';
import { EtagMismatch } from 'pmtiles';
import { FileSource, PMTiles } from 'pmtiles';
import { TileType } from 'pmtiles';

const nativeDecompress = async (
  buf: ArrayBuffer,
  compression: Compression
): Promise<ArrayBuffer> => {
  if (compression === Compression.None || compression === Compression.Unknown) {
    return buf;
  }
  if (compression === Compression.Gzip) {
    const stream = new Response(buf).body;
    const result = stream?.pipeThrough(new DecompressionStream('gzip'));
    return new Response(result).arrayBuffer();
  }
  throw new Error('Unsupported compression');
};

const CACHE = new ResolvedValueCache(25, undefined, nativeDecompress);

class R2Source implements Source {
  bucket: R2Bucket;
  key: string;

  constructor(bucket: R2Bucket, key: string) {
    this.bucket = bucket;
    this.key = key;
  }

  getKey() {
    return this.key;
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string) {
    const r2Object = await this.bucket.get(this.key, {
      range: {
        offset: offset,
        length: length,
      },
      onlyIf: {
        etagMatches: etag,
      },
    });
    if (!r2Object) {
      throw new Error('Not found');
    }
    const objectBody = r2Object as R2ObjectBody;
    if (!objectBody.body) {
      throw new EtagMismatch();
    }
    const objectArrayBuffer = await objectBody.arrayBuffer();
    return {
      data: objectArrayBuffer,
      etag: objectBody.etag,
      cacheControl: objectBody.httpMetadata?.cacheControl,
      expires: objectBody.httpMetadata?.cacheExpiry?.toISOString(),
    };
  }
}

export const openPMTiles = (bucket: R2Bucket, key: string) => {
  const source = new R2Source(bucket, key);
  return new PMTiles(source, CACHE, nativeDecompress);
};

export const generateTileJSONFromPMTiles = async (
  pmtiles: PMTiles,
  origin: string,
  key: string
) => {
  const header = await pmtiles.getHeader();
  const metadata = (await pmtiles.getMetadata()) as any;
  const tileType = getPMTilesTileType(header.tileType);

  return {
    tilejson: '3.0.0',
    scheme: 'xyz',
    name: metadata.name,
    version: metadata.version,
    description: metadata.description,
    attribution: metadata.attribution,
    tiles: [`${origin}/tiles/${key}/{z}/{x}/{y}${tileType.ext}`],
    vector_layers: metadata.vector_layers,
    minzoom: header.minZoom,
    maxzoom: header.maxZoom,
    bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
    center: [header.centerLon, header.centerLat, header.minZoom],
  };
};

export const checkPMTiles = async (pmtilesFile: File) => {
  try {
    const pmtiles = new PMTiles(new FileSource(pmtilesFile), CACHE, nativeDecompress);
    await pmtiles.getHeader();
    await pmtiles.getMetadata();
    return true;
  } catch (e) {
    return false;
  }
};
export const getTileFromPMTiles = async (
  pmtiles: PMTiles,
  z: number,
  x: number,
  y: number,
  ext: string
) => {
  const header = await pmtiles.getHeader();
  const tileType = getPMTilesTileType(header.tileType);
  if (z < header.minZoom || z > header.maxZoom) {
    throw new Error('Invalid zoom level');
  }
  if (tileType.ext !== `.${ext}` && ext !== 'pbf') {
    throw new Error('Invalid extension');
  }
  const tile = await pmtiles.getZxy(z, x, y);
  if (!tile || !tile.data) {
    throw new Error('Tile not found');
  }

  return {
    body: tile.data,
    headers: tileType.headers,
  };
};

const getPMTilesTileType = (
  typenum: Header['tileType']
): {
  type: string;
  ext: string;
  headers: Record<string, string>;
} => {
  switch (typenum) {
    case TileType.Mvt:
      return {
        type: 'mvt',
        ext: '.mvt',
        headers: {
          'Content-Type': 'application/x-protobuf',
        },
      };
    case TileType.Png:
      return {
        type: 'png',
        ext: '.png',
        headers: {
          'Content-Type': 'image/png',
        },
      };
    case TileType.Jpeg:
      return {
        type: 'jpeg',
        ext: '.jpg',
        headers: {
          'Content-Type': 'image/jpeg',
        },
      };
    case TileType.Webp:
      return {
        type: 'webp',
        ext: '.webp',
        headers: {
          'Content-Type': 'image/webp',
        },
      };
    case TileType.Avif:
      return {
        type: 'avif',
        ext: '.avif',
        headers: {
          'Content-Type': 'image/avif',
        },
      };
    case TileType.Unknown:
      return {
        type: 'unknown',
        ext: '',
        headers: {},
      };
    default:
      throw new Error('Invalid tile type');
  }
};

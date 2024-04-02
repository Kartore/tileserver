// Original: https://github.com/mapbox/fontnik/blob/master/lib/sdf.js
//
//--- LICENSE ----------------------------------
// Copyright (c) 2014, Mapbox
// All rights reserved.
//
//   Redistribution and use in source and binary forms, with or without modification,
//   are permitted provided that the following conditions are met:
//
//   - Redistributions of source code must retain the above copyright notice, this
//     list of conditions and the following disclaimer.
//   - Redistributions in binary form must reproduce the above copyright notice, this
//     list of conditions and the following disclaimer in the documentation and/or
//     other materials provided with the distribution.
//   - Neither the name of the copyright holder nor the names of its contributors may
//     be used to endorse or promote products derived from this software without
//     specific prior written permission.
//
//   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
//   ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
//   WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
//   DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
//   ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
//   (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
//   LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
//   ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
//   (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
//   SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// ------------------------------------------------------------------------------------

import type { Font, Glyph, PathCommand } from 'opentype.js';
import Protobuf from 'pbf';
import rbush from 'rbush';

import Curve3Div from '../libs/AntiGrainGeometry/Curve3Div';
import Curve4Div from '../libs/AntiGrainGeometry/Curve4Div';
import type { Glyphs as ProtobufGlyphs, Glyph as ProtobufGlyph } from '~/proto/glyphs';
import { readGlyphs } from '~/proto/glyphs';
import { writeGlyphs } from '~/proto/glyphs';

// calculates the bbox for a line segment from a to b
function bbox(
  a: [number, number],
  b: [number, number],
): [number, number, number, number, [number, number], [number, number]] {
  return [
    /* x1 */ Math.min(a[0], b[0]),
    /* y1 */ Math.min(a[1], b[1]),
    /* x2 */ Math.max(a[0], b[0]),
    /* y2 */ Math.max(a[1], b[1]),
    a,
    b,
  ];
}

function pt(x: number, y: number): [number, number] {
  return [x, y];
}

// point in polygon ray casting algorithm
function polyContainsPoint(
  rings: Ring[],
  p: {
    x: number;
    y: number;
  },
) {
  let c = false,
    ring,
    p1,
    p2;

  for (let k = 0; k < rings.length; k++) {
    ring = rings[k];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      p1 = ring[i];
      p2 = ring[j];
      if (
        p1[1] > p.y != p2[1] > p.y &&
        p.x < ((p2[0] - p1[0]) * (p.y - p1[1])) / (p2[1] - p1[1]) + p1[0]
      ) {
        c = !c;
      }
    }
  }
  return c;
}

function squaredDistance(v: [number, number], w: [number, number]) {
  const a = v[0] - w[0];
  const b = v[1] - w[1];
  return a * a + b * b;
}

function projectPointOnLineSegment(
  p: [number, number],
  v: [number, number],
  w: [number, number],
): [number, number] {
  const l2 = squaredDistance(v, w);
  if (l2 === 0) return v;
  const t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  if (t < 0) return v;
  if (t > 1) return w;
  return [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
}

function squaredDistanceToLineSegment(
  p: [number, number],
  v: [number, number],
  w: [number, number],
) {
  const s = projectPointOnLineSegment(p, v, w);
  return squaredDistance(p, s);
}

function squaredDistanceToUnboundedLineSegment(
  p: [number, number],
  v: [number, number],
  w: [number, number],
) {
  if (v[0] == w[0] && v[1] == w[1]) {
    return squaredDistance(v, w);
  } else {
    const numerator = (w[0] - v[0]) * (v[1] - p[1]) - (v[0] - p[0]) * (w[1] - v[1]);
    return (numerator * numerator) / squaredDistance(v, w);
  }
}

function minDistanceToLineSegment(
  tree: rbush<[number, number, number, number, [number, number], [number, number]]>,
  p: [number, number],
  radius: number,
) {
  const squaredRadius = radius * radius;
  const segments = tree.search({
    minX: p[0] - radius,
    minY: p[1] - radius,
    maxX: p[0] + radius,
    maxY: p[1] + radius,
  });
  let squaredDistance = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const v = segment[4];
    const w = segment[5];
    const dist = squaredDistanceToLineSegment(p, v, w);
    if (dist < squaredDistance && dist < squaredRadius) {
      squaredDistance = dist;
    }
  }
  return Math.sqrt(squaredDistance);
}

function minDistanceToUnboundedLineSegment(
  tree: rbush<[number, number, number, number, [number, number], [number, number]]>,
  p: [number, number],
  radius: number,
) {
  const segments = tree.search({
    minX: p[0] - radius,
    minY: p[1] - radius,
    maxX: p[0] + radius,
    maxY: p[1] + radius,
  });
  let squaredDistance = Infinity;
  let closestSegments: [[number, number], [number, number]][] = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const v = segment[4];
    const w = segment[5];
    const dist = squaredDistanceToLineSegment(p, v, w);
    if (dist < squaredDistance) {
      squaredDistance = dist;
      closestSegments = [[v, w]];
    } else if (dist == squaredDistance) {
      closestSegments.push([v, w]);
    }
  }

  if (closestSegments.length) {
    let dist = -Infinity;
    for (let i = 0; i < closestSegments.length; i++) {
      const s = closestSegments[i];
      const d = Math.abs(squaredDistanceToUnboundedLineSegment(p, s[0], s[1]));
      if (d > dist) {
        dist = d;
      }
    }
    return Math.sqrt(dist);
  } else {
    return Infinity;
  }
}

type Ring = [number, number][];

function pathToRings(path: PathCommand[]) {
  const rings: Ring[] = [];
  let ring: Ring = [];

  const curve3 = new Curve3Div(2);

  const curve4 = new Curve4Div(2);

  function closeRing(ring: Ring) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]]);
    }
  }

  // Build a list of contours (= rings) and flatten the bezier curves into regular line segments.
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    if (segment.type == 'M') {
      if (ring.length) {
        closeRing(ring);
        rings.push(ring);
      }
      ring = [[segment.x, segment.y]];
    } else if (segment.type == 'L') {
      ring.push([segment.x, segment.y]);
    } else if (segment.type == 'Q') {
      const prev = ring.pop();
      if (prev) {
        curve3.calcurate(prev[0], prev[1], segment.x1, segment.y1, segment.x, segment.y);
        ring = ring.concat(curve3.getPoints());
      }
    } else if (segment.type == 'C') {
      const prev = ring.pop();
      if (prev) {
        curve4.calcurate(
          prev[0],
          prev[1],
          segment.x1,
          segment.y1,
          segment.x2,
          segment.y2,
          segment.x,
          segment.y,
        );
        ring = ring.concat(curve4.getPoints());
      }
    } else if (segment.type == 'Z') {
      if (ring.length) {
        ring.push([ring[0][0], ring[0][1]]);
      }
    } else {
      throw segment;
    }
  }
  if (ring.length) {
    closeRing(ring);
    rings.push(ring);
  }

  return rings;
}

function ringsToSDF(rings: Ring[], width: number, height: number, buffer: number, cutoff: number) {
  width += 2 * buffer;
  height += 2 * buffer;

  const tree = new rbush<[number, number, number, number, [number, number], [number, number]]>(9);
  const offset = 0.5;
  const radius = 8;
  const data = new Uint8ClampedArray(width * height);

  // Buffer
  for (let j = 0; j < rings.length; j++) {
    const ring = rings[j];
    for (let i = 0; i < ring.length; i++) {
      const point = ring[i];
      point[0] += buffer;
      point[1] += buffer;
    }
  }

  // Insert all line segments into the rtree, regardless of what contour they belong to.
  for (let j = 0; j < rings.length; j++) {
    const ring = rings[j];
    for (let i = 1; i < ring.length; i++) {
      tree.insert(bbox([ring[i - 1][0], ring[i - 1][1]], [ring[i][0], ring[i][1]]));
    }
  }

  // Loop over every pixel and determine the positive/negative distance to the outline.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;

      const p = pt(x + offset, y + offset);

      let d = minDistanceToLineSegment(tree, p, radius) * (256 / radius);

      // Invert if point is inside.
      const inside = polyContainsPoint(rings, { x: x + offset, y: y + offset });
      if (inside) {
        d = -d;
      }

      // Shift the 0 so that we can fit a few negative values into our 8 bits.
      d += cutoff * 256;

      // Note that info.data is /clamped/ to 0-255. This makes sure there are no overflows
      // or underflows.
      data[i] = 255 - d;
    }
  }

  return data;
}

export const glyphToSDF = (
  glyph: Glyph,
  font: Font,
  fontSize: number,
  buffer: number,
  cutoff: number,
) => {
  const fontScale = font.unitsPerEm / fontSize;
  const ascender = Math.round(font.ascender / fontScale);

  const info: {
    width: number;
    height: number;
    data: Uint8ClampedArray | null;

    glyphBearingX: number;
    glyphWidth: number;
    glyphBearingY: number;
    glyphHeight: number;
    glyphTop: number;
    glyphAdvance: number;
  } = {
    width: 0,
    height: 0,
    data: null,

    glyphBearingX: 0,
    glyphWidth: 0,
    glyphBearingY: 0,
    glyphHeight: 0,
    glyphTop: 0,
    glyphAdvance: Math.round(glyph.advanceWidth ?? 0 / fontScale),
  };

  // Extract the glyph's path and scale it to the correct font size.
  const path = glyph.getPath(0, 0, fontSize).commands;
  const rings = pathToRings(path);

  if (!rings.length) {
    return info;
  }

  // Calculate the real glyph bbox.
  let xMin = Infinity;
  let yMin = Infinity;
  let xMax = -Infinity;
  let yMax = -Infinity;

  for (let j = 0; j < rings.length; j++) {
    const ring = rings[j];
    for (let i = 0; i < ring.length; i++) {
      const point = ring[i];
      if (point[0] > xMax) xMax = point[0];
      if (point[0] < xMin) xMin = point[0];
      if (point[1] > yMax) yMax = point[1];
      if (point[1] < yMin) yMin = point[1];
    }
  }

  xMin = Math.round(xMin);
  yMin = Math.round(yMin);
  xMax = Math.round(xMax);
  yMax = Math.round(yMax);

  // Offset so that glyph outlines are in the bounding box.
  for (let j = 0; j < rings.length; j++) {
    const ring = rings[j];
    for (let i = 0; i < ring.length; i++) {
      const point = ring[i];
      point[0] += -xMin;
      point[1] += -yMin;
    }
  }
  //console.log(xMin, xMax, yMin, yMax)
  if (xMax - xMin === 0 /*|| yMax == yMin === 0*/) {
    return info;
  }

  info.glyphBearingX = xMin;
  info.glyphWidth = xMax - xMin;
  info.glyphBearingY = -yMin;
  info.glyphHeight = yMax - yMin;
  info.glyphTop = -yMin - ascender;
  info.width = info.glyphWidth + 2 * buffer;
  info.height = info.glyphHeight + 2 * buffer;
  info.data = ringsToSDF(rings, info.glyphWidth, info.glyphHeight, buffer, cutoff);
  return info;
};

export const pathToSDF = (
  path: PathCommand[],
  width: number,
  height: number,
  buffer: number,
  cutoff: number,
): Uint8ClampedArray => {
  return ringsToSDF(pathToRings(path), width, height, buffer, cutoff);
};

export const generateFontProtocolBuf = (font: Font, from: number, to: number) => {
  const pbf = new Protobuf();
  const glyphs: ProtobufGlyphs = {
    stacks: [
      {
        name: font.names.postScriptName.en,
        range: `${from}-${to}`,
        glyphs: [...new Array(to - from + 1)]
          .map((_, i) => {
            const charCode = from + i;
            const glyph = font.charToGlyph(String.fromCharCode(charCode));
            if (glyph.index > 0) {
              const info = glyphToSDF(glyph, font, 24, 3, 2 / 8);
              return {
                id: charCode,
                bitmap: info.data ? new Uint8Array(info.data.buffer) : null,
                width: info.glyphWidth,
                height: info.glyphHeight,
                left: info.glyphBearingX,
                top: info.glyphTop,
                advance: 0, //info.glyphAdvance,
              };
            }
            return {
              id: charCode,
              bitmap: null,
              width: 0,
              height: 0,
              left: 0,
              top: 0,
              advance: 0,
            };
          })
          .filter((value): value is ProtobufGlyph => value != null),
      },
    ],
  };
  writeGlyphs(glyphs, pbf);
  const buf = pbf.finish();
  return buf; /*
  const stream = new Response(buf).body;
  console.log(stream);
  const result = stream?.pipeThrough(new DecompressionStream('deflate'));
  console.log(result);
  return new Response(result).arrayBuffer();*/
};

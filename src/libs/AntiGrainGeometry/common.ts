// Original: https://github.com/mapbox/fontnik/blob/master/lib/curve3_div.js
// Original: https://github.com/mapbox/fontnik/blob/master/lib/curve4_div.js
//
// Based on:
//----------------------------------------------------------------------------
// Anti-Grain Geometry - Version 2.4
// Copyright (C) 2002-2005 Maxim Shemanarev (http://www.antigrain.com)
// Copyright (C) 2005 Tony Juricic (tonygeek@yahoo.com)
//
// Permission to copy, use, modify, sell and distribute this software
// is granted provided this copyright notice appears in all copies.
// This software is provided "as is" without express or implied
// warranty, and with no claim as to its suitability for any purpose.
//
//----------------------------------------------------------------------------
// Contact: mcseem@antigrain.com
//          mcseemagg@yahoo.com
//          http://www.antigrain.com
//----------------------------------------------------------------------------

export const pointDimension = (x: number, y: number): [number, number] => {
  return [x, y];
};

export const calcSquareDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
};

export const CURVE_COLLINEARITY_EPSILON = 1e-30;
export const CURVE_ANGLE_TOLERANCE_EPSILON = 0.01;
export const CURVE_RECUSION_LIMIT = 32;

export const APPROXIMATION_SCALE = 1.0;
export const ANGLE_TOLERANCE = 0.0;
export const CUSP_LIMIT = 0.0;

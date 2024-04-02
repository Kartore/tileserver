// Original: https://github.com/mapbox/fontnik/blob/master/lib/curve3_div.js
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

import {
  ANGLE_TOLERANCE,
  APPROXIMATION_SCALE,
  calcSquareDistance,
  CURVE_ANGLE_TOLERANCE_EPSILON,
  CURVE_COLLINEARITY_EPSILON,
  CURVE_RECUSION_LIMIT,
  pointDimension,
} from './common';

class Curve3Div {
  approximationScale;
  points: [number, number][];
  distanceToleranceSquare: number;

  constructor(approximationScale = APPROXIMATION_SCALE) {
    this.points = [];
    this.approximationScale = approximationScale;
    this.distanceToleranceSquare = 0.5 / approximationScale;
    this.distanceToleranceSquare *= this.distanceToleranceSquare;
  }

  calcurate(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    this.points = [];
    this.bezier(x1, y1, x2, y2, x3, y3);
  }
  getPoints() {
    return this.points;
  }

  bezier(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    this.points.push(pointDimension(x1, y1));
    this.recursiveBezier(x1, y1, x2, y2, x3, y3, 0);
    this.points.push(pointDimension(x3, y3));
  }

  recursiveBezier(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    level: number
  ) {
    if (level > CURVE_RECUSION_LIMIT) {
      return;
    }

    // Calculate all the mid-points of the line segments
    const x12 = (x1 + x2) / 2;
    const y12 = (y1 + y2) / 2;
    const x23 = (x2 + x3) / 2;
    const y23 = (y2 + y3) / 2;
    const x123 = (x12 + x23) / 2;
    const y123 = (y12 + y23) / 2;

    const dx = x3 - x1;
    const dy = y3 - y1;
    let d = Math.abs((x2 - x3) * dy - (y2 - y3) * dx);
    let da;

    if (d > CURVE_COLLINEARITY_EPSILON) {
      // Regular case
      if (d * d <= this.distanceToleranceSquare * (dx * dx + dy * dy)) {
        // If the curvature doesn't exceed the distance_tolerance value
        // we tend to finish subdivisions.
        if (ANGLE_TOLERANCE < CURVE_ANGLE_TOLERANCE_EPSILON) {
          this.points.push(pointDimension(x123, y123));
          return;
        }

        // Angle & Cusp Condition
        da = Math.abs(Math.atan2(y3 - y2, x3 - x2) - Math.atan2(y2 - y1, x2 - x1));
        if (da >= Math.PI) {
          da = 2 * Math.PI - da;
        }

        if (da < ANGLE_TOLERANCE) {
          // Finally we can stop the recursion
          this.points.push(pointDimension(x123, y123));
          return;
        }
      }
    } else {
      // Collinear case
      da = dx * dx + dy * dy;
      if (da === 0) {
        d = calcSquareDistance(x1, y1, x2, y2);
      } else {
        d = ((x2 - x1) * dx + (y2 - y1) * dy) / da;
        if (d > 0 && d < 1) {
          // Simple collinear case, 1---2---3
          // We can leave just two endpoints
          return;
        }
        if (d <= 0) {
          d = calcSquareDistance(x2, y2, x1, y1);
        } else if (d >= 1) {
          d = calcSquareDistance(x2, y2, x3, y3);
        } else {
          d = calcSquareDistance(x2, y2, x1 + d * dx, y1 + d * dy);
        }
      }
      if (d < this.distanceToleranceSquare) {
        this.points.push(pointDimension(x2, y2));
        return;
      }
    }

    // Continue subdivision
    this.recursiveBezier(x1, y1, x12, y12, x123, y123, level + 1);
    this.recursiveBezier(x123, y123, x23, y23, x3, y3, level + 1);
  }
}

export default Curve3Div;

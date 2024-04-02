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

import {
  ANGLE_TOLERANCE,
  APPROXIMATION_SCALE,
  calcSquareDistance,
  CURVE_ANGLE_TOLERANCE_EPSILON,
  CURVE_COLLINEARITY_EPSILON,
  CURVE_RECUSION_LIMIT,
  CUSP_LIMIT,
  pointDimension,
} from './common';

class Curve4Div {
  approximationScale;
  points: [number, number][];
  distanceToleranceSquare: number;
  constructor(approximationScale = APPROXIMATION_SCALE) {
    this.points = [];
    this.approximationScale = approximationScale;
    this.distanceToleranceSquare = 0.5 / approximationScale;
    this.distanceToleranceSquare *= this.distanceToleranceSquare;
  }

  calcurate(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number
  ) {
    this.points = [];
    this.bezier(x1, y1, x2, y2, x3, y3, x4, y4);
  }

  getPoints() {
    return this.points;
  }

  bezier(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number
  ) {
    this.points.push(pointDimension(x1, y1));
    this.recusiveBezier(x1, y1, x2, y2, x3, y3, x4, y4, 0);
    this.points.push(pointDimension(x4, y4));
  }

  recusiveBezier(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number,
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
    const x34 = (x3 + x4) / 2;
    const y34 = (y3 + y4) / 2;
    const x123 = (x12 + x23) / 2;
    const y123 = (y12 + y23) / 2;
    const x234 = (x23 + x34) / 2;
    const y234 = (y23 + y34) / 2;
    const x1234 = (x123 + x234) / 2;
    const y1234 = (y123 + y234) / 2;

    // Try to approximate the full cubic curve by a single straight line
    const dx = x4 - x1;
    const dy = y4 - y1;

    let d2 = Math.abs((x2 - x4) * dy - (y2 - y4) * dx);
    let d3 = Math.abs((x3 - x4) * dy - (y3 - y4) * dx);
    let da1, da2, k;

    switch (
      (Number(d2 > CURVE_COLLINEARITY_EPSILON) << 1) +
      Number(d3 > CURVE_COLLINEARITY_EPSILON)
    ) {
      case 0:
        // All collinear OR p1==p4
        k = dx * dx + dy * dy;
        if (k === 0) {
          d2 = calcSquareDistance(x1, y1, x2, y2);
          d3 = calcSquareDistance(x4, y4, x3, y3);
        } else {
          k = 1 / k;
          da1 = x2 - x1;
          da2 = y2 - y1;
          d2 = k * (da1 * dx + da2 * dy);
          da1 = x3 - x1;
          da2 = y3 - y1;
          d3 = k * (da1 * dx + da2 * dy);
          if (d2 > 0 && d2 < 1 && d3 > 0 && d3 < 1) {
            // Simple collinear case, 1---2---3---4
            // We can leave just two endpoints
            return;
          }
          if (d2 <= 0) {
            d2 = calcSquareDistance(x2, y2, x1, y1);
          } else if (d2 >= 1) {
            d2 = calcSquareDistance(x2, y2, x4, y4);
          } else {
            d2 = calcSquareDistance(x2, y2, x1 + d2 * dx, y1 + d2 * dy);
          }

          if (d3 <= 0) {
            d3 = calcSquareDistance(x3, y3, x1, y1);
          } else if (d3 >= 1) {
            d3 = calcSquareDistance(x3, y3, x4, y4);
          } else {
            d3 = calcSquareDistance(x3, y3, x1 + d3 * dx, y1 + d3 * dy);
          }
        }

        if (d2 > d3) {
          if (d2 < this.distanceToleranceSquare) {
            this.points.push(pointDimension(x2, y2));
            return;
          }
        } else {
          if (d3 < this.distanceToleranceSquare) {
            this.points.push(pointDimension(x3, y3));
            return;
          }
        }
        break;

      case 1:
        // p1,p2,p4 are collinear, p3 is significant
        if (d3 * d3 <= this.distanceToleranceSquare * (dx * dx + dy * dy)) {
          if (ANGLE_TOLERANCE < CURVE_ANGLE_TOLERANCE_EPSILON) {
            this.points.push(pointDimension(x23, y23));
            return;
          }

          // Angle Condition
          da1 = Math.abs(Math.atan2(y4 - y3, x4 - x3) - Math.atan2(y3 - y2, x3 - x2));
          if (da1 >= Math.PI) da1 = 2 * Math.PI - da1;

          if (da1 < ANGLE_TOLERANCE) {
            this.points.push(pointDimension(x2, y2));
            this.points.push(pointDimension(x3, y3));
            return;
          }

          if (CUSP_LIMIT !== 0.0) {
            if (da1 > CUSP_LIMIT) {
              this.points.push(pointDimension(x3, y3));
              return;
            }
          }
        }
        break;

      case 2:
        // p1,p3,p4 are collinear, p2 is significant
        if (d2 * d2 <= this.distanceToleranceSquare * (dx * dx + dy * dy)) {
          if (ANGLE_TOLERANCE < CURVE_ANGLE_TOLERANCE_EPSILON) {
            this.points.push(pointDimension(x23, y23));
            return;
          }

          // Angle Condition
          da1 = Math.abs(Math.atan2(y3 - y2, x3 - x2) - Math.atan2(y2 - y1, x2 - x1));
          if (da1 >= Math.PI) da1 = 2 * Math.PI - da1;

          if (da1 < ANGLE_TOLERANCE) {
            this.points.push(pointDimension(x2, y2));
            this.points.push(pointDimension(x3, y3));
            return;
          }

          if (CUSP_LIMIT !== 0.0) {
            if (da1 > CUSP_LIMIT) {
              this.points.push(pointDimension(x2, y2));
              return;
            }
          }
        }
        break;

      case 3:
        // Regular case
        if ((d2 + d3) * (d2 + d3) <= this.distanceToleranceSquare * (dx * dx + dy * dy)) {
          // If the curvature doesn't exceed the distance_tolerance value
          // we tend to finish subdivisions.
          if (ANGLE_TOLERANCE < CURVE_ANGLE_TOLERANCE_EPSILON) {
            this.points.push(pointDimension(x23, y23));
            return;
          }

          // Angle & Cusp Condition
          k = Math.atan2(y3 - y2, x3 - x2);
          da1 = Math.abs(k - Math.atan2(y2 - y1, x2 - x1));
          da2 = Math.abs(Math.atan2(y4 - y3, x4 - x3) - k);
          if (da1 >= Math.PI) da1 = 2 * Math.PI - da1;
          if (da2 >= Math.PI) da2 = 2 * Math.PI - da2;

          if (da1 + da2 < ANGLE_TOLERANCE) {
            // Finally we can stop the recursion
            this.points.push(pointDimension(x23, y23));
            return;
          }

          if (CUSP_LIMIT !== 0.0) {
            if (da1 > CUSP_LIMIT) {
              this.points.push(pointDimension(x2, y2));
              return;
            }

            if (da2 > CUSP_LIMIT) {
              this.points.push(pointDimension(x3, y3));
              return;
            }
          }
        }
        break;
    }

    // Continue subdivision
    this.recusiveBezier(x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1);
    this.recusiveBezier(x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1);
  }
}

export default Curve4Div;

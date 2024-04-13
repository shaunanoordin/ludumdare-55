import { SHAPES } from '@avo/constants'
import { isZero } from '@avo/misc'

const USE_CIRCLE_APPROXIMATION = false

export default class Physics {

  //----------------------------------------------------------------

  /*
  Checks if objA is touching objB.
  - If true, returns the corrected coordinates for objA and objB, in form:
    { a: { x, y },
      b: { x, y } }
  - If false, returns null.
   */
  static checkCollision (objA, objB) {
    if (!objA || !objB || objA === objB) return null

    // Circle + Circle collision
    if (objA.shape === SHAPES.CIRCLE && objB.shape === SHAPES.CIRCLE) {
      return Physics.checkCollision_circleCircle(objA, objB)
    }

    // Polygon + Polygon collision. (Squares are polygons, of course.)
    else if (
      (objA.shape === SHAPES.SQUARE || objA.shape === SHAPES.POLYGON) &&
      (objB.shape === SHAPES.SQUARE || objB.shape === SHAPES.POLYGON)
    ) {
      return Physics.checkCollision_polygonPolygon(objA, objB)
    }

    // Circle + Polygon collision.
    else if (
      objA.shape === SHAPES.CIRCLE &&
      (objB.shape === SHAPES.SQUARE || objB.shape === SHAPES.POLYGON)
    ) {
      if (USE_CIRCLE_APPROXIMATION) return Physics.checkCollision_polygonPolygon(objA, objB)

      return Physics.checkCollision_circlePolygon(objA, objB)
    }

    // Polygon + Circle collision
    // It's the reverse of the previous scenario.
    else if (
      (objA.shape === SHAPES.SQUARE || objA.shape === SHAPES.POLYGON) &&
      objB.shape === SHAPES.CIRCLE
    ) {
      if (USE_CIRCLE_APPROXIMATION) return Physics.checkCollision_polygonPolygon(objA, objB)

      let correction = Physics.checkCollision_circlePolygon(objB, objA)
      if (correction) {
        correction = {
          a: correction.b,
          b: correction.a,
        }
      }
      return correction
    }

    return null
  }
  //----------------------------------------------------------------

  static checkCollision_circleCircle (objA, objB) {
    let fractionA = 0
    let fractionB = 0
    if (!objA.solid || !objB.solid) {
      //If either object isn't solid, there's no collision correction.
    } else if (objA.movable && objB.movable) {
      fractionA = 0.5
      fractionB = 0.5
    } else if (objA.movable) {
      fractionA = 1
    } else if (objB.movable) {
      fractionB = 1
    }

    const distX = objB.x - objA.x
    const distY = objB.y - objA.y
    const dist = Math.sqrt(distX * distX + distY * distY)
    const minimumDist = objA.radius + objB.radius
    if (dist < minimumDist) {
      const angle = Math.atan2(distY, distX)
      const correctDist = minimumDist
      const cosAngle = Math.cos(angle)
      const sinAngle = Math.sin(angle)

      const motion = Physics.getPostCollisionMotion(objA, objB)

      return {
        a: {
          x: objA.x - cosAngle * (correctDist - dist) * fractionA,
          y: objA.y - sinAngle * (correctDist - dist) * fractionA,
          pushX: motion && motion.a.pushX,
          pushY: motion && motion.a.pushY,
        },
        b: {
          x: objB.x + cosAngle * (correctDist - dist) * fractionB,
          y: objB.y + sinAngle * (correctDist - dist) * fractionB,
          pushX: motion && motion.b.pushX,
          pushY: motion && motion.b.pushY,
        }
      }
    }

    return null
  }

  //----------------------------------------------------------------

  static checkCollision_polygonPolygon (objA, objB) {
    let fractionA = 0
    let fractionB = 0
    if (!objA.solid || !objB.solid) {
      //If either object isn't solid, there's no collision correction.
    } else if (objA.movable && objB.movable) {
      fractionA = 0.5
      fractionB = 0.5
    } else if (objA.movable) {
      fractionA = 1
    } else if (objB.movable) {
      fractionB = 1
    }

    let correction = null
    const verticesA = objA.vertices
    const verticesB = objB.vertices
    const projectionAxes = [...Physics.getShapeNormals(objA), ...Physics.getShapeNormals(objB)]
    for (let i = 0 ; i < projectionAxes.length ; i++) {
      const axis = projectionAxes[i]
      const projectionA = { min: Infinity, max: -Infinity }
      const projectionB = { min: Infinity, max: -Infinity }

      for (let j = 0 ; j < verticesA.length ; j++) {
        const val = Physics.dotProduct(axis, verticesA[j])
        projectionA.min = Math.min(projectionA.min, val)
        projectionA.max = Math.max(projectionA.max, val)
      }
      for (let j = 0 ; j < verticesB.length ; j++) {
        const val = Physics.dotProduct(axis, verticesB[j])
        projectionB.min = Math.min(projectionB.min, val)
        projectionB.max = Math.max(projectionB.max, val)
      }

      const overlap = Math.max(0, Math.min(projectionA.max, projectionB.max) - Math.max(projectionA.min, projectionB.min))
      if (!correction || overlap < correction.magnitude) {
        const sign = Math.sign((projectionB.min + projectionB.max) - (projectionA.min + projectionA.max))
        correction = {
          magnitude: overlap,
          x: axis.x * overlap * sign,
          y: axis.y * overlap * sign,
        }
      }
    }

    if (correction && correction.magnitude > 0) {
      return {
        a: {
          x: objA.x - correction.x * fractionA,
          y: objA.y - correction.y * fractionA,
        },
        b: {
          x: objB.x + correction.x * fractionB,
          y: objB.y + correction.y * fractionB,
        }
      }
    }

    return null
  }

  //----------------------------------------------------------------

  static checkCollision_circlePolygon (objA, objB) {
    let fractionA = 0
    let fractionB = 0
    if (!objA.solid || !objB.solid) {
      //If either object isn't solid, there's no collision correction.
    } else if (objA.movable && objB.movable) {
      fractionA = 0.5
      fractionB = 0.5
    } else if (objA.movable) {
      fractionA = 1
    } else if (objB.movable) {
      fractionB = 1
    }

    const distX = objB.x - objA.x
    const distY = objB.y - objA.y
    const dist = Math.sqrt(distX * distX + distY * distY)
    const angle = Math.atan2(distY, distX)
    const centreToCentreAxis = (dist !== 0)
      ? { x: distX / dist, y: distY / dist }
      : { x: 0, y: 0 }

    let correction = null
    const verticesB = objB.vertices
    const projectionAxes = [centreToCentreAxis, ...Physics.getShapeNormals(objB)]
    for (let i = 0 ; i < projectionAxes.length ; i++) {
      const axis = projectionAxes[i]
      const scalarA = Physics.dotProduct(axis, { x: objA.x, y: objA.y })
      const projectionA = { min: scalarA - objA.radius, max: scalarA + objA.radius }
      const projectionB = { min: Infinity, max: -Infinity }

      for (let j = 0 ; j < verticesB.length ; j++) {
        const val = Physics.dotProduct(axis, verticesB[j])
        projectionB.min = Math.min(projectionB.min, val)
        projectionB.max = Math.max(projectionB.max, val)
      }

      const overlap = Math.max(0, Math.min(projectionA.max, projectionB.max) - Math.max(projectionA.min, projectionB.min))
      if (!correction || overlap < correction.magnitude) {
        const sign = Math.sign((projectionB.min + projectionB.max) - (projectionA.min + projectionA.max))
        correction = {
          magnitude: overlap,
          x: axis.x * overlap * sign,
          y: axis.y * overlap * sign,
        }
      }
    }

    if (correction && correction.magnitude > 0) {
      return {
        a: {
          x: objA.x - correction.x * fractionA,
          y: objA.y - correction.y * fractionA,
        },
        b: {
          x: objB.x + correction.x * fractionB,
          y: objB.y + correction.y * fractionB,
        }
      }
    }
  }

  //----------------------------------------------------------------

  /*  Gets the NORMALISED normals for each edge of the object's shape. Assumes the object has the 'vertices' property.
   */
  static getShapeNormals (obj) {
    const vertices = obj.vertices
    if (!vertices) return null
    if (vertices.length < 2) return []  //Look, you need to have at least three vertices to be a shape.

    //First, calculate the edges connecting each vertice.
    //--------------------------------
    const edges = []
    for (let i = 0 ; i < vertices.length ; i++) {
      const p1 = vertices[i]
      const p2 = vertices[(i+1) % vertices.length]
      edges.push({
        x: p2.x - p1.x,
        y: p2.y - p1.y,
      })
    }
    //--------------------------------

    //Calculate the NORMALISED normals for each edge.
    //--------------------------------
    return edges.map((edge) => {
      const dist = Math.sqrt(edge.x * edge.x + edge.y * edge.y)
      if (dist === 0) return { x: 0, y: 0 }
      return {
        x: -edge.y / dist,
        y: edge.x / dist,
      }
    })
    //--------------------------------
  }

  //----------------------------------------------------------------

  static getPostCollisionMotion (objA, objB) {
    if (!objA || !objB) return null

    if (
      !objA.movable || !objA.solid || objA.mass === 0
      || !objB.movable || !objB.solid || objB.mass === 0
      || (objA.mass + objB.mass) === 0
    ) return null

    const collisionAngle = Math.atan2(objB.y - objA.y, objB.x - objA.x)
    const ANGLE_90 = Math.PI / 2
    const totalMass = objA.mass + objB.mass
    const aSpd = objA.pushSpeed
    const bSpd = objB.pushSpeed
    const aAng = objA.pushAngle
    const bAng = objB.pushAngle
    const aMass = objA.mass
    const bMass = objB.mass

    const aGroup =
      ( aSpd * Math.cos(aAng - collisionAngle) * (aMass - bMass)
        + 2 * bMass * bSpd * Math.cos(bAng - collisionAngle)
      ) / totalMass
    const bGroup =
      ( bSpd * Math.cos(bAng - collisionAngle) * (bMass - aMass)
        + 2 * aMass * aSpd * Math.cos(aAng - collisionAngle)
      ) / totalMass

    const objA_pushX =
      aGroup * Math.cos(collisionAngle)
      + aSpd * Math.sin(aAng - collisionAngle) * Math.cos(collisionAngle + ANGLE_90)
    const objA_pushY =
      aGroup * Math.sin(collisionAngle)
      + aSpd * Math.sin(aAng - collisionAngle) * Math.sin(collisionAngle + ANGLE_90)
    const objB_pushX =
      bGroup * Math.cos(collisionAngle)
      + bSpd * Math.sin(bAng - collisionAngle) * Math.cos(collisionAngle + ANGLE_90)
    const objB_pushY =
      bGroup * Math.sin(collisionAngle)
      + bSpd * Math.sin(bAng - collisionAngle) * Math.sin(collisionAngle + ANGLE_90)

    return {
      a: {
        pushX: objA_pushX,
        pushY: objA_pushY,
      },
      b: {
        pushX: objB_pushX,
        pushY: objB_pushY,
      },
    }
  }

  //----------------------------------------------------------------

  static dotProduct (vectorA, vectorB) {
    if (!vectorA || !vectorB) return null
    return vectorA.x * vectorB.x + vectorA.y * vectorB.y
  }

  //----------------------------------------------------------------

  /*
  Calculate intersection between two lines (a ray and a segment of a polygon).
  Useful for determining valids line of sight.

  - Each line is in the format { start: { x, y }, end: { x, y } }
  - Returns null if there's no intersection.
  - Returns { x, y, distanceFactor } if there's an intersection.
    x, y are the coordinates of the intersection point.
    distanceFactor is how far from the ray's origin point the intersection
    occurs. If 1, intersection occurs at the ray's end point. If 0.5,
    intersection occurs halfway between the ray's origin point and end point.

  Original code from https://ncase.me/sight-and-light/
   */
  static getLineIntersection (ray, segment) {
    // Each line is represented in the format:
    // line = originPoint + directionVector * distanceFactor
    // Or a bit more simply:
    // line = origin (o) + direction (d) * factor (f)

    // Ray
    let r_ox = ray.start.x
    let r_oy = ray.start.y
    let r_dx = ray.end.x - ray.start.x
    let r_dy = ray.end.y - ray.start.y

    // Segment
    let s_ox = segment.start.x
    let s_oy = segment.start.y
    let s_dx = segment.end.x - segment.start.x
    let s_dy = segment.end.y - segment.start.y

    // The intersection occurs where ray.x === segment.x and ray.y === segment.y
    // So, we need to solve for r_factor and s_factor in...
    // r_ox + r_dx * r_factor = s_ox + s_dx * s_factor && r_oy + r_dy * r_factor = s_oy + s_dy * s_factor
    let r_factor = null
    let s_factor = null

    if (!isZero(s_dx * r_dy - s_dy * r_dx)) {
      // Solve for s_factor.
      s_factor = (r_dx * (s_oy - r_oy) + r_dy * (r_ox - s_ox)) / (s_dx * r_dy - s_dy * r_dx)

      // There are two ways to solve for r_factor; one works when the ray
      // isn't perfectly horizontal, the other works when the ray isn't
      // perfectly vertical.
      if (!isZero(r_dx)) {
        r_factor = (s_ox + s_dx * s_factor - r_ox) / r_dx
      } else if (!isZero(r_dy)) {
        r_factor = (s_oy + s_dy * s_factor - r_oy) / r_dy
      }
    }

    // Check if the intersection occurs within the length of both lines.
    // (The maths above calculates for infinitely long lines.)
    if (
      r_factor === null || s_factor === null
      || r_factor < 0 || r_factor > 1
      || s_factor < 0 || s_factor > 1
    ) return null

    // Point of intersection
    return {
      x: r_ox + r_dx * r_factor,
      y: r_oy + r_dy * r_factor,
      distanceFactor: r_factor
    }
  }

  //----------------------------------------------------------------

}

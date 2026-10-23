declare module "jsts/org/locationtech/jts/io/GeoJSONReader.js" {
  export default class GeoJSONReader {
    constructor();
    read(input: unknown): unknown;
  }
}
declare module "jsts/org/locationtech/jts/operation/valid/IsValidOp.js" {
  export default class IsValidOp {
    constructor(geometry: unknown);
    isValid(): boolean;
    getValidationError(): { toString(): string } | null;
  }
}
declare module "jsts/org/locationtech/jts/io/GeoJSONWriter.js" {
  export default class GeoJSONWriter {
    write(input: unknown): unknown;
  }
}
declare module "jsts/org/locationtech/jts/operation/overlay/snap/SnapIfNeededOverlayOp.js" {
  export default class Overlay {
    static intersection(a: unknown, b: unknown): unknown;
    static difference(a: unknown, b: unknown): unknown;
  }
}
declare module "jsts/org/locationtech/jts/operation/buffer/BufferOp.js" {
  export default class BufferOp {
    static bufferOp(a: unknown, distance: number): unknown;
  }
}

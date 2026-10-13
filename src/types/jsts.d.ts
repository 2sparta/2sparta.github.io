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

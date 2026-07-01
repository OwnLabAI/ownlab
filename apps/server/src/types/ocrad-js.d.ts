declare module "ocrad.js/ocrad.js" {
  const OCRAD: (image: {
    width: number;
    height: number;
    data: Uint8ClampedArray | Buffer;
  }) => string;

  export default OCRAD;
}

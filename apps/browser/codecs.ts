import { parseZip } from "../../packages/core/zip";
import type { Codecs, DecodedPng } from "../../packages/core";

export const browserCodecs: Codecs = {
  async decodePng(bytes): Promise<DecodedPng> {
    const bitmap = await createImageBitmap(new Blob([bytes as unknown as BlobPart], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return { width: image.width, height: image.height, rgba: new Uint8Array(image.data) };
  },
  async encodePng(png) {
    const canvas = new OffscreenCanvas(png.width, png.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.putImageData(new ImageData(new Uint8ClampedArray(png.rgba), png.width, png.height), 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return new Uint8Array(await blob.arrayBuffer());
  },
  async inflateZip(bytes) {
    return parseZip(bytes, async (data) => {
      const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    });
  },
};

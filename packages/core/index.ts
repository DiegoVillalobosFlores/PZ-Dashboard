export interface GameFiles {
  read(path: string): Promise<Uint8Array<ArrayBuffer>>;
  list(dir: string): Promise<string[]>;
  stat(path: string): Promise<{ mtimeMs: number } | null>;
  write(path: string, data: string | Uint8Array): Promise<void>;
}

export interface DecodedPng {
  width: number;
  height: number;
  rgba: Uint8Array;
}

export interface Codecs {
  decodePng(bytes: Uint8Array): Promise<DecodedPng> | DecodedPng;
  encodePng(png: DecodedPng): Promise<Uint8Array<ArrayBuffer>> | Uint8Array<ArrayBuffer>;
  inflateZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> | Map<string, Uint8Array>;
}

export { setCategory, getCategory, getAllCategories, onCategoryUpdate } from "./state/store";
export type { Command } from "./state/commands";
export { writeCommand } from "./state/commands";
export { parseXModel, bindPose } from "./model/xModel";
export { findRoute } from "./map/routing";
export { makeRoutes } from "./routes";
export type { RouteHandler, RouteOptions } from "./routes";
export { listZip, parseZip } from "./zip";

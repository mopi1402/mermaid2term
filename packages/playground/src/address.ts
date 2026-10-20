export interface Address {
  name: string | undefined;
  source: string | undefined;
}

type Bytes = Uint8Array<ArrayBuffer>;

const RAW_SEPARATOR = "_";
const PACKED_SEPARATOR = "~";

const FORMAT = "deflate-raw" as const;

// A link that unpacks past this is read as damaged: a few hundred KB of deflate would otherwise freeze the tab.
const MAX_SOURCE_BYTES = 1_000_000;

const pipe = (bytes: Bytes, stream: CompressionStream | DecompressionStream): ReadableStream<Uint8Array> => {
  const writer = stream.writable.getWriter();
  void writer.write(bytes).catch(() => undefined);
  void writer.close().catch(() => undefined);
  return stream.readable;
};

const drained = async (readable: ReadableStream<Uint8Array>, limit: number): Promise<Bytes | undefined> => {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    size += next.value.byteLength;
    if (size > limit) {
      void reader.cancel().catch(() => undefined);
      return undefined;
    }
    chunks.push(next.value);
  }
  const whole = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    whole.set(chunk, at);
    at += chunk.byteLength;
  }
  return whole;
};

const toBase64 = (bytes: Bytes): string => {
  let latin = "";
  for (const byte of bytes) latin += String.fromCharCode(byte);
  return btoa(latin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const fromBase64 = (code: string): Bytes | undefined => {
  try {
    const latin = atob(code.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(latin, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
};

const toText = (bytes: Bytes): string => new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);

export const written = async (name: string | undefined, source: string): Promise<string> => {
  const bytes = new TextEncoder().encode(source);
  const raw = toBase64(bytes);
  const packed = toBase64(new Uint8Array(await new Response(pipe(bytes, new CompressionStream(FORMAT))).arrayBuffer()));
  const [separator, code] = packed.length < raw.length ? [PACKED_SEPARATOR, packed] : [RAW_SEPARATOR, raw];
  return `${name ?? ""}${separator}${code}`;
};

const split = (fragment: string): { at: number; packed: boolean } | undefined => {
  const raw = fragment.indexOf(RAW_SEPARATOR);
  const packed = fragment.indexOf(PACKED_SEPARATOR);
  if (packed >= 0 && (raw < 0 || packed < raw)) return { at: packed, packed: true };
  return raw < 0 ? undefined : { at: raw, packed: false };
};

export const read = async (fragment: string): Promise<Address> => {
  const where = split(fragment);
  if (where === undefined) return { name: fragment === "" ? undefined : fragment, source: undefined };

  const name = fragment.slice(0, where.at);
  const nameOnly = { name: name === "" ? undefined : name, source: undefined };
  const bytes = fromBase64(fragment.slice(where.at + 1));
  if (bytes === undefined) return nameOnly;
  if (!where.packed) return bytes.byteLength > MAX_SOURCE_BYTES ? nameOnly : { ...nameOnly, source: toText(bytes) };

  try {
    const unpacked = await drained(pipe(bytes, new DecompressionStream(FORMAT)), MAX_SOURCE_BYTES);
    return unpacked === undefined ? nameOnly : { ...nameOnly, source: toText(unpacked) };
  } catch {
    return nameOnly;
  }
};

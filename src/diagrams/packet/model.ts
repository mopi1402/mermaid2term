const ROW_BITS = 32;

interface PacketField {
  start: number;
  end: number;
  label: string;
}

export interface Packet {
  fields: PacketField[];
  rowBits: number;
  showBits: boolean;
  title: string;
}

export const makePacket = (): Packet => ({ fields: [], rowBits: ROW_BITS, showBits: true, title: "" });
export const fieldBits = (field: PacketField): number => field.end - field.start + 1;

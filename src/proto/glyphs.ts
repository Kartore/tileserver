import type Pbf from 'pbf';

export type Glyph = {
  id: number;
  bitmap: Uint8Array | null;
  width: number;
  height: number;
  left: number;
  top: number;
  advance: number;
};

const readGlyph = (
  pbf: Pbf,
  end: number
): {
  id: number;
  bitmap: Uint8Array | null;
  width: number;
  height: number;
  left: number;
  top: number;
  advance: number;
} => {
  return pbf.readFields<Glyph>(
    _readGlyphField,
    { id: 0, bitmap: null, width: 0, height: 0, left: 0, top: 0, advance: 0 },
    end
  );
};

const _readGlyphField = (tag: number, obj?: Glyph, pbf?: Pbf) => {
  if (!obj || !pbf) return;
  if (tag === 1) obj.id = pbf.readVarint();
  else if (tag === 2) obj.bitmap = pbf.readBytes();
  else if (tag === 3) obj.width = pbf.readVarint();
  else if (tag === 4) obj.height = pbf.readVarint();
  else if (tag === 5) obj.left = pbf.readSVarint();
  else if (tag === 6) obj.top = pbf.readSVarint();
  else if (tag === 7) obj.advance = pbf.readVarint();
};

const writeGlyph = (obj: Glyph, pbf?: Pbf) => {
  if (!pbf) return null;
  if (obj.id != null) pbf.writeVarintField(1, obj.id);
  if (obj.bitmap != null) pbf.writeBytesField(2, obj.bitmap);
  if (obj.width != null) pbf.writeVarintField(3, obj.width);
  if (obj.height != null) pbf.writeVarintField(4, obj.height);
  if (obj.left != null) pbf.writeSVarintField(5, obj.left);
  if (obj.top != null) pbf.writeSVarintField(6, obj.top);
  if (obj.advance != null) pbf.writeVarintField(7, obj.advance);
};

type FontStack = {
  name: string;
  range: string;
  glyphs: Glyph[];
};

const readFontStack = (pbf: Pbf, end: number): FontStack => {
  return pbf.readFields<FontStack>(_readFontStackField, { name: '', range: '', glyphs: [] }, end);
};

const _readFontStackField = (tag: number, obj?: FontStack, pbf?: Pbf) => {
  if (!obj || !pbf) return;
  if (tag === 1) obj.name = pbf.readString();
  else if (tag === 2) obj.range = pbf.readString();
  else if (tag === 3) obj.glyphs.push(readGlyph(pbf, pbf.readVarint() + pbf.pos));
};

const writeFontStack = (obj: FontStack, pbf?: Pbf) => {
  if (!pbf) return;
  if (obj.name != null) pbf.writeStringField(1, obj.name);
  if (obj.range != null) pbf.writeStringField(2, obj.range);
  if (obj.glyphs != null)
    for (let i = 0; i < obj.glyphs.length; i++) pbf.writeMessage(3, writeGlyph, obj.glyphs[i]);
};

export type Glyphs = {
  stacks: FontStack[];
};

export const readGlyphs = (pbf: Pbf, end?: number) => {
  return pbf.readFields(_readGlyphsField, { stacks: [] }, end);
};

const _readGlyphsField = (tag: number, obj?: Glyphs, pbf?: Pbf) => {
  if (!obj || !pbf) return;
  if (tag === 1) obj.stacks.push(readFontStack(pbf, pbf.readVarint() + pbf.pos));
};

export const writeGlyphs = (obj: Glyphs, pbf?: Pbf) => {
  if (!pbf) return;
  if (obj.stacks != null)
    for (let i = 0; i < obj.stacks.length; i++) pbf.writeMessage(1, writeFontStack, obj.stacks[i]);
};

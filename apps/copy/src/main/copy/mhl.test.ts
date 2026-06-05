import { describe, it, expect } from 'vitest';
import { buildMhl, parseMhl, type MhlEntry, type MhlMeta } from './mhl';

const META: MhlMeta = {
  startISO: '2026-06-05T14:37:00.000Z',
  finishISO: '2026-06-05T14:39:00.000Z',
  tool: 'JM Copy 0.1.0',
  username: 'tech',
  hostname: 'studio-mac',
};

const ENTRIES: MhlEntry[] = [
  { relPath: 'A001/clip01.mov', sizeBytes: 1024, xxhash64: '0123456789abcdef', hashDate: '2026-06-05T14:38:00.000Z' },
  { relPath: 'Audio/Ton & Co.wav', sizeBytes: 2048, xxhash64: 'fedcba9876543210', md5: 'd41d8cd98f00b204e9800998ecf8427e' },
];

describe('MHL roundtrip', () => {
  it('builds valid-looking MHL 1.1 XML', () => {
    const xml = buildMhl(ENTRIES, META);
    expect(xml).toContain('<hashlist version="1.1">');
    expect(xml).toContain('<xxhash64be>0123456789abcdef</xxhash64be>');
    expect(xml).toContain('<tool>JM Copy 0.1.0</tool>');
    // XML special chars escaped
    expect(xml).toContain('Ton &amp; Co.wav');
  });

  it('parses back the entries it wrote', () => {
    const parsed = parseMhl(buildMhl(ENTRIES, META));
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      relPath: 'A001/clip01.mov',
      sizeBytes: 1024,
      xxhash64: '0123456789abcdef',
    });
    expect(parsed[1].relPath).toBe('Audio/Ton & Co.wav');
    expect(parsed[1].md5).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('reads legacy <xxhash64> and <xxhash> element names', () => {
    const legacy = `<hashlist version="1.1"><hash><file>x.mov</file><size>1</size><xxhash64>aabb</xxhash64></hash></hashlist>`;
    expect(parseMhl(legacy)[0].xxhash64).toBe('aabb');
  });
});

import { canonicalJson, hashPayload } from './hash';

describe('hashPayload', () => {
  it('ignores key order and undefined values', () => {
    expect(hashPayload({ a: 1, b: { c: 2, d: 3 } })).toBe(
      hashPayload({ b: { d: 3, c: 2 }, a: 1, e: undefined }),
    );
  });

  it('is sensitive to values and array order', () => {
    expect(hashPayload({ a: [1, 2] })).not.toBe(hashPayload({ a: [2, 1] }));
    expect(hashPayload({ a: 1 })).not.toBe(hashPayload({ a: 2 }));
  });

  it('serializes nested structures deterministically', () => {
    expect(canonicalJson({ b: [1, { z: 1, a: 2 }], a: null })).toBe(
      '{"a":null,"b":[1,{"a":2,"z":1}]}',
    );
  });
});

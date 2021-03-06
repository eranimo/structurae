const { ArrayViewMixin, TypeViewMixin, MapViewMixin, MapView, ObjectView } = require('../index');

const Int32ArrayView = ArrayViewMixin('int32');
const Float64View = TypeViewMixin('float64');

const MapA = MapViewMixin({
  $id: 'MapViewA',
  type: 'object',
  properties: {
    a: { type: 'number' },
    b: {
      type: 'array',
      items: { type: 'integer' },
    },
    c: {
      type: 'array',
      items: {
        $id: 'MapAObject',
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string', maxLength: 10 },
        },
      },
    },
    d: { type: 'string' },
    e: {
      type: 'array',
      items: {
        type: 'array',
        maxItems: 2,
        items: { type: 'number' },
      },
    },
  },
});

describe('MapViewMixin', () => {
  const PersonSchema = {
    $id: 'PersonMap',
    type: 'object',
    properties: {
      a: { type: 'number' },
    },
  };

  it('creates a MapView class from a given JSON Schema', () => {
    const Person = MapViewMixin(PersonSchema);
    expect(Person.prototype instanceof MapView).toBe(true);
  });

  it('returns cached class if the same schema is reused', () => {
    MapViewMixin(PersonSchema);
    const Person = MapView.Views.PersonMap;
    expect(MapViewMixin(PersonSchema)).toBe(Person);
  });

  it('uses custom ObjectView class to initialize nested objects', () => {
    class CustomObjectView extends ObjectView {}
    const Person = MapViewMixin(
      {
        $id: 'CustomMap',
        type: 'object',
        properties: {
          a: {
            $id: 'CustomNestedObject',
            type: 'object',
            properties: {
              b: { type: 'number' },
            },
          },
        },
      },
      undefined,
      CustomObjectView,
    );
    expect(Person.layout.a.View.prototype instanceof CustomObjectView).toBe(true);
  });
});

describe('MapView', () => {
  describe('get', () => {
    it('returns the JavaScript value at a given field', () => {
      const map = MapA.from({ a: 42 });
      expect(map.get('a')).toBe(42);
    });

    it('returns undefined if the value is not set', () => {
      const map = MapA.from({ b: [1] });
      expect(map.get('a')).toBe(undefined);
      expect(map.get('b')).toEqual([1]);
    });

    it('throws if the view does not have the field', () => {
      const map = MapA.from({});
      expect(() => {
        map.get('abc');
      }).toThrow('Field "abc" is not found.');
    });
  });

  describe('getView', () => {
    it('returns a view of a given field', () => {
      const map = MapA.from({ a: 42 });
      expect(map.getView('a') instanceof Float64View).toBe(true);
    });

    it('returns undefined if the field is not set', () => {
      const map = MapA.from({ b: [1] });
      expect(map.getView('a')).toBe(undefined);
      expect(map.getView('b') instanceof Int32ArrayView).toBe(true);
    });

    it('throws if the view does not have the field', () => {
      const map = MapA.from({});
      expect(() => {
        map.getView('abc');
      }).toThrow('Field "abc" is not found.');
    });
  });

  describe('set', () => {
    it('sets a JavaScript value of a field', () => {
      const map = MapA.from({ a: 5 });
      map.set('a', 42);
      expect(map.get('a')).toBe(42);
    });

    it('does not set a value for a missing field', () => {
      const map = MapA.from({ b: [1] });
      map.set('a', 10);
      expect(map.get('a')).toBe(undefined);
    });

    it('throws if the view does not have the field', () => {
      const map = MapA.from({});
      expect(() => {
        map.set('abc', 1);
      }).toThrow('Field "abc" is not found.');
    });
  });

  describe('setView', () => {
    it('copies a given view into a field', () => {
      const map = MapA.from({ a: 1 });
      const number = Float64View.from(42);
      map.setView('a', number);
      expect(map.get('a')).toBe(42);
    });

    it('throws if the view does not have the field', () => {
      const map = MapA.from({});
      expect(() => {
        map.setView('abc', 1);
      }).toThrow('Field "abc" is not found.');
    });
  });

  describe('toJSON', () => {
    it('returns an an object corresponding to the view', () => {
      const expected = {
        a: 42,
        b: [20, 30, 10],
        c: [
          { id: 10, name: 'abc' },
          { id: 5, name: 'def' },
        ],
      };
      const map = MapA.from(expected);
      expect(map.toJSON()).toEqual(expected);
    });

    it('handles map views within larger buffers', () => {
      const expected = {
        a: 42,
        b: [20, 30, 10],
        c: [
          { id: 10, name: 'abc' },
          { id: 5, name: 'def' },
        ],
      };
      const buffer = new ArrayBuffer(1000);
      const temp = MapA.from(expected);
      const view = new DataView(buffer);
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength).set(
        new Uint8Array(temp.buffer, temp.byteOffset, temp.byteLength),
        100,
      );
      expect(MapA.toJSON(view, 100)).toEqual(expected);
    });
  });

  describe('getLength', () => {
    it('returns the byte length of a map view to hold a given object', () => {
      expect(MapA.getLength({ a: 42, b: [1], c: [1, 2] })).toBe(1 * 8 + 1 * 4 + 2 * 14 + 6 * 4);
      expect(MapA.getLength({ b: [1] })).toBe(0 * 8 + 1 * 4 + 6 * 4);
      expect(MapA.getLength({})).toBe(0 * 0 + 0 * 0 + 6 * 4);
      expect(MapA.getLength({ b: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] })).toBe(0 * 0 + 10 * 4 + 6 * 4);
    });
  });

  describe('from', () => {
    it('creates a map view from a given object', () => {
      const expected = {
        a: 42,
        b: [20, 30, 10],
        c: [
          { id: 10, name: 'abc' },
          { id: 5, name: 'def' },
        ],
        d: 'abc',
        e: [
          [3, 4],
          [5, 7],
          [6, 8],
        ],
      };
      const map = MapA.from(expected);
      expect(map.toJSON()).toEqual(expected);
    });

    it('treats undefined and null fields as missing', () => {
      const object = {
        a: undefined,
        b: null,
        c: [
          { id: 10, name: 'abc' },
          { id: 5, name: 'def' },
        ],
        d: 'abc',
        e: [
          [3, 4],
          [5, 7],
          [6, 8],
        ],
      };
      const { a, b, ...expected } = object;
      const map = MapA.from(object);
      expect(map.toJSON()).toEqual(expected);
    });

    it('truncates strings and arrays longer than set max sizes', () => {
      const MaxMap = MapViewMixin({
        $id: 'MaxMap',
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'string', maxLength: 2 },
          c: { type: 'array', items: { type: 'integer' }, maxItems: 3 },
        },
      });
      const object = {
        b: 'abcd',
        c: [6, 7, 8, 9, 10],
      };
      const map = MaxMap.from(object);
      expect(map.toJSON()).toEqual({
        b: 'ab',
        c: [6, 7, 8],
      });
    });
  });
});

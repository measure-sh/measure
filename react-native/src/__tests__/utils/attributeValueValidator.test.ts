import { validateAttributes } from '../../utils/attributeValueValidator';

describe('validateAttributes', () => {

  it('should return only valid string, number, and boolean values', () => {
    const input = {
      str: 'hello',
      num: 123,
      bool: true,
      nullValue: null,
      obj: { nested: 'bad' },
      arr: [1, 2, 3],
      undef: undefined,
    };

    const output = validateAttributes(input);

    expect(output).toEqual({
      str: 'hello',
      num: 123,
      bool: true,
    });
  });
});
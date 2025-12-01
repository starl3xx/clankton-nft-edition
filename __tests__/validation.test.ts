import {
  isValidEthAddress,
  normalizeAddress,
  isValidAction,
  isValidFid,
  parseFid,
  validateRequiredFields,
  sanitizeString,
  VALID_ACTIONS,
} from '../lib/validation'

describe('isValidEthAddress', () => {
  test('accepts valid lowercase address', () => {
    expect(isValidEthAddress('0x1234567890123456789012345678901234567890')).toBe(true)
  })

  test('accepts valid checksummed address', () => {
    expect(isValidEthAddress('0xABCDEF1234567890123456789012345678901234')).toBe(true)
  })

  test('accepts mixed case address', () => {
    expect(isValidEthAddress('0xAbCdEf1234567890123456789012345678901234')).toBe(true)
  })

  test('rejects address without 0x prefix', () => {
    expect(isValidEthAddress('1234567890123456789012345678901234567890')).toBe(false)
  })

  test('rejects address with wrong length', () => {
    expect(isValidEthAddress('0x12345')).toBe(false)
    expect(isValidEthAddress('0x12345678901234567890123456789012345678901234')).toBe(false)
  })

  test('rejects address with invalid characters', () => {
    expect(isValidEthAddress('0x123456789012345678901234567890123456789G')).toBe(false)
    expect(isValidEthAddress('0x1234567890123456789012345678901234567890!')).toBe(false)
  })

  test('rejects empty string', () => {
    expect(isValidEthAddress('')).toBe(false)
  })

  test('rejects null-like inputs', () => {
    expect(isValidEthAddress('null')).toBe(false)
    expect(isValidEthAddress('undefined')).toBe(false)
  })
})

describe('normalizeAddress', () => {
  test('converts uppercase to lowercase', () => {
    expect(normalizeAddress('0xABCDEF1234567890123456789012345678901234'))
      .toBe('0xabcdef1234567890123456789012345678901234')
  })

  test('keeps lowercase unchanged', () => {
    expect(normalizeAddress('0xabcdef1234567890123456789012345678901234'))
      .toBe('0xabcdef1234567890123456789012345678901234')
  })

  test('handles mixed case', () => {
    expect(normalizeAddress('0xAbCdEf1234567890123456789012345678901234'))
      .toBe('0xabcdef1234567890123456789012345678901234')
  })
})

describe('isValidAction', () => {
  test.each(VALID_ACTIONS)('accepts valid action: %s', (action) => {
    expect(isValidAction(action)).toBe(true)
  })

  test('rejects invalid action string', () => {
    expect(isValidAction('invalid')).toBe(false)
    expect(isValidAction('CAST')).toBe(false) // Case sensitive
    expect(isValidAction('follow')).toBe(false)
  })

  test('rejects non-string inputs', () => {
    expect(isValidAction(123)).toBe(false)
    expect(isValidAction(null)).toBe(false)
    expect(isValidAction(undefined)).toBe(false)
    expect(isValidAction({})).toBe(false)
    expect(isValidAction(['cast'])).toBe(false)
  })
})

describe('isValidFid', () => {
  test('accepts positive integer', () => {
    expect(isValidFid(1)).toBe(true)
    expect(isValidFid(12345)).toBe(true)
    expect(isValidFid(999999)).toBe(true)
  })

  test('accepts string integer', () => {
    expect(isValidFid('1')).toBe(true)
    expect(isValidFid('12345')).toBe(true)
  })

  test('rejects zero', () => {
    expect(isValidFid(0)).toBe(false)
    expect(isValidFid('0')).toBe(false)
  })

  test('rejects negative numbers', () => {
    expect(isValidFid(-1)).toBe(false)
    expect(isValidFid('-1')).toBe(false)
  })

  test('rejects floats', () => {
    expect(isValidFid(1.5)).toBe(false)
    expect(isValidFid('1.5')).toBe(false)
  })

  test('rejects non-numeric strings', () => {
    expect(isValidFid('abc')).toBe(false)
    expect(isValidFid('12abc')).toBe(false)
  })

  test('rejects null and undefined', () => {
    expect(isValidFid(null)).toBe(false)
    expect(isValidFid(undefined)).toBe(false)
  })
})

describe('parseFid', () => {
  test('parses positive integer', () => {
    expect(parseFid(12345)).toBe(12345)
  })

  test('parses string integer', () => {
    expect(parseFid('12345')).toBe(12345)
  })

  test('returns null for invalid inputs', () => {
    expect(parseFid(0)).toBe(null)
    expect(parseFid(-1)).toBe(null)
    expect(parseFid('abc')).toBe(null)
    expect(parseFid(null)).toBe(null)
    expect(parseFid(undefined)).toBe(null)
    expect(parseFid(1.5)).toBe(null)
  })
})

describe('validateRequiredFields', () => {
  test('returns valid for object with all required fields', () => {
    const body = { name: 'test', value: 123 }
    const result = validateRequiredFields(body, ['name', 'value'])
    expect(result.valid).toBe(true)
  })

  test('returns invalid with missing field name', () => {
    const body = { name: 'test' }
    const result = validateRequiredFields(body, ['name', 'value'])
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.missing).toBe('value')
    }
  })

  test('returns invalid for null body', () => {
    const result = validateRequiredFields(null, ['name'])
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.missing).toBe('body')
    }
  })

  test('returns invalid for non-object body', () => {
    const result = validateRequiredFields('string', ['name'])
    expect(result.valid).toBe(false)
  })

  test('treats undefined values as missing', () => {
    const body = { name: undefined }
    const result = validateRequiredFields(body, ['name'])
    expect(result.valid).toBe(false)
  })

  test('treats null values as missing', () => {
    const body = { name: null }
    const result = validateRequiredFields(body, ['name'])
    expect(result.valid).toBe(false)
  })
})

describe('sanitizeString', () => {
  test('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })

  test('limits length', () => {
    expect(sanitizeString('hello world', 5)).toBe('hello')
  })

  test('returns null for empty strings', () => {
    expect(sanitizeString('')).toBe(null)
    expect(sanitizeString('   ')).toBe(null)
  })

  test('returns null for non-strings', () => {
    expect(sanitizeString(123)).toBe(null)
    expect(sanitizeString(null)).toBe(null)
    expect(sanitizeString(undefined)).toBe(null)
  })

  test('uses default max length of 1000', () => {
    const longString = 'a'.repeat(1500)
    const result = sanitizeString(longString)
    expect(result?.length).toBe(1000)
  })
})

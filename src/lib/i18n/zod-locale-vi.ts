// Utility functions (copied from zod internal utils)
function stringifyPrimitive(value: any): string {
  if (typeof value === 'bigint') return value.toString() + 'n'
  if (typeof value === 'string') return `"${value}"`
  return `${value}`
}

function joinValues<T extends Array<string | number | bigint | boolean | null>>(
  array: T,
  separator = '|',
): string {
  return array.map((val) => stringifyPrimitive(val)).join(separator)
}

// Type definitions (simplified from zod types)
type ZodStringFormats =
  | 'email'
  | 'url'
  | 'uuid'
  | 'uuidv4'
  | 'uuidv6'
  | 'nanoid'
  | 'guid'
  | 'cuid'
  | 'cuid2'
  | 'ulid'
  | 'xid'
  | 'ksuid'
  | 'datetime'
  | 'date'
  | 'time'
  | 'duration'
  | 'ipv4'
  | 'ipv6'
  | 'cidrv4'
  | 'cidrv6'
  | 'base64'
  | 'base64url'
  | 'json_string'
  | 'e164'
  | 'jwt'
  | 'regex'
  | 'starts_with'
  | 'ends_with'
  | 'includes'
  | 'emoji'
  | 'template_literal'

type ZodErrorMap = (issue: any) => string

const error: () => ZodErrorMap = () => {
  const Sizable: Record<string, { unit: string; verb: string }> = {
    string: { unit: 'ký tự', verb: 'có' },
    file: { unit: 'byte', verb: 'có' },
    array: { unit: 'phần tử', verb: 'có' },
    set: { unit: 'phần tử', verb: 'có' },
  }

  function getSizing(origin: string): { unit: string; verb: string } | null {
    return Sizable[origin] ?? null
  }

  const parsedType = (data: any): string => {
    const t = typeof data

    switch (t) {
      case 'number': {
        return Number.isNaN(data) ? 'NaN' : 'số'
      }
      case 'object': {
        if (Array.isArray(data)) {
          return 'mảng'
        }
        if (data === null) {
          return 'null'
        }

        if (
          Object.getPrototypeOf(data) !== Object.prototype &&
          data.constructor
        ) {
          return data.constructor.name
        }
      }
    }
    return t
  }

  const Nouns: {
    [k in ZodStringFormats | (string & {})]?: string
  } = {
    regex: 'đầu vào',
    email: 'địa chỉ email',
    url: 'URL',
    emoji: 'emoji',
    uuid: 'UUID',
    uuidv4: 'UUIDv4',
    uuidv6: 'UUIDv6',
    nanoid: 'nanoid',
    guid: 'GUID',
    cuid: 'cuid',
    cuid2: 'cuid2',
    ulid: 'ULID',
    xid: 'XID',
    ksuid: 'KSUID',
    datetime: 'ngày giờ ISO',
    date: 'ngày ISO',
    time: 'giờ ISO',
    duration: 'khoảng thời gian ISO',
    ipv4: 'địa chỉ IPv4',
    ipv6: 'địa chỉ IPv6',
    cidrv4: 'dải IPv4',
    cidrv6: 'dải IPv6',
    base64: 'chuỗi mã hóa base64',
    base64url: 'chuỗi mã hóa base64url',
    json_string: 'chuỗi JSON',
    e164: 'số E.164',
    jwt: 'JWT',
    template_literal: 'đầu vào',
  }

  return (issue) => {
    switch (issue.code) {
      case 'invalid_type':
        return `Đầu vào không hợp lệ: mong đợi ${issue.expected}, nhận được ${parsedType(issue.input)}`
      case 'invalid_value':
        if (issue.values.length === 1)
          return `Đầu vào không hợp lệ: mong đợi ${stringifyPrimitive(issue.values[0])}`
        return `Tùy chọn không hợp lệ: mong đợi một trong các giá trị ${joinValues(issue.values, '|')}`
      case 'too_big': {
        const adj = issue.inclusive ? '<=' : '<'
        const sizing = getSizing(issue.origin)
        if (sizing)
          return `Quá lớn: mong đợi ${issue.origin || 'giá trị'} ${sizing.verb} ${adj}${issue.maximum.toString()} ${sizing.unit || 'phần tử'}`
        return `Quá lớn: mong đợi ${issue.origin || 'giá trị'} ${adj}${issue.maximum.toString()}`
      }
      case 'too_small': {
        const sizing = getSizing(issue.origin)
        if (sizing) {
          // Improved natural Vietnamese message for string length validation
          if (issue.origin === 'string' && issue.inclusive) {
            return `Phải có ít nhất ${issue.minimum.toString()} ${sizing.unit}`
          }
          if (issue.origin === 'string' && !issue.inclusive) {
            return `Phải có hơn ${issue.minimum.toString()} ${sizing.unit}`
          }
          // For other types, use the original format
          const adj = issue.inclusive ? '>=' : '>'
          return `Quá nhỏ: mong đợi ${issue.origin} ${sizing.verb} ${adj}${issue.minimum.toString()} ${sizing.unit}`
        }

        const adj = issue.inclusive ? '>=' : '>'
        return `Quá nhỏ: mong đợi ${issue.origin} ${adj}${issue.minimum.toString()}`
      }
      case 'invalid_format': {
        const _issue = issue as {
          format: string
          prefix?: string
          suffix?: string
          includes?: string
          pattern?: string
        }
        if (_issue.format === 'starts_with')
          return `Chuỗi không hợp lệ: phải bắt đầu bằng "${_issue.prefix}"`
        if (_issue.format === 'ends_with')
          return `Chuỗi không hợp lệ: phải kết thúc bằng "${_issue.suffix}"`
        if (_issue.format === 'includes')
          return `Chuỗi không hợp lệ: phải bao gồm "${_issue.includes}"`
        if (_issue.format === 'regex')
          return `Chuỗi không hợp lệ: phải khớp với mẫu ${_issue.pattern}`
        // Improved email error message
        if (_issue.format === 'email') {
          return 'Địa chỉ email không hợp lệ'
        }
        return `${Nouns[_issue.format] ?? issue.format} không hợp lệ`
      }
      case 'not_multiple_of':
        return `Số không hợp lệ: phải là bội số của ${issue.divisor}`
      case 'unrecognized_keys':
        return `Khóa không được nhận dạng: ${joinValues(issue.keys, ', ')}`
      case 'invalid_key':
        return `Khóa không hợp lệ trong ${issue.origin}`
      case 'invalid_union':
        return 'Đầu vào không hợp lệ'
      case 'invalid_element':
        return `Giá trị không hợp lệ trong ${issue.origin}`
      default:
        return 'Đầu vào không hợp lệ'
    }
  }
}

export default function (): { localeError: ZodErrorMap } {
  return {
    localeError: error(),
  }
}

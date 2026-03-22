export type PropValue =
  | { kind: 'primitive'; value: string | number | boolean | null | undefined }
  | { kind: 'template'; value: string }
  | { kind: 'functionCall'; callee: string; args: PropValue[]; import?: ImportSpecifier }
  | { kind: 'lambda'; parameters: string[]; body: string }
  | { kind: 'object'; properties: Record<string, PropValue> }
  | { kind: 'array'; elements: PropValue[] }
  | { kind: 'tuple'; elements: PropValue[] }
  | { kind: 'raw'; sourceText: string }

export interface ImportSpecifier {
  name: string
  from: string
  isDefault?: boolean
}

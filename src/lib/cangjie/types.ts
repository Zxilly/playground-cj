export interface RunMessage {
  compiler_output: string
  compiler_code: number
  bin_output: string
  bin_code: number
}

export interface FormatMessage {
  formatted: string
  formatter_output: string
  formatter_code: number
}

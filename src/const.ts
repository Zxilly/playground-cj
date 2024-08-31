// eslint-disable-next-line node/prefer-global/process
export const BACKEND_URL = process.env.BACKEND_URL ?? 'https://cj-api.learningman.top'
// eslint-disable-next-line node/prefer-global/process
export const BASE_URL = process.env.BASE_URL ?? 'https://playground.cj.zxilly.dev'

export const defaultCode = `package cangjie

// 编写你的第一个仓颉程序
main(): Int64 {
    println("你好，仓颉！")
    return 0
}
`

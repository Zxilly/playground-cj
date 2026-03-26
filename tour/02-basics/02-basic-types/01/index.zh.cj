main() {
    // 十进制字面量
    let decimal = 42
    println("十进制 42 = ${decimal}")

    // 不同进制表示同一个值
    let hex = 0x2A        // 十六进制
    let binary = 0b101010  // 二进制
    println("十六进制 0x2A = ${hex}")
    println("二进制 0b101010 = ${binary}")

    // 使用下划线提高可读性
    let million = 1_000_000
    println("一百万 = ${million}")

    // 使用后缀指定类型
    let small: Int8 = 127
    let unsigned: UInt64 = 100u64
    println("Int8: ${small}, UInt64: ${unsigned}")

    // 验证 Int64 是默认类型
    let inferred = 999
    println("推断类型: ${inferred}")
}
main() {
    // 显式类型标注
    let days: Int64 = 42
    let small: Int8 = 127
    let position: UInt32 = 100u32  // 使用后缀指定类型

    println("天数: ${days}")
    println("小整数: ${small}")
    println("位置: ${position}")

    // 不同进制的字面量
    let decimal = 42
    let hex = 0x2A          // 十六进制
    let binary = 0b101010   // 二进制
    let octal = 0o52        // 八进制

    println("十进制: ${decimal}")
    println("十六进制 0x2A: ${hex}")
    println("二进制 0b101010: ${binary}")
    println("八进制 0o52: ${octal}")

    // 下划线分隔符提高可读性
    let million = 1_000_000
    let largeHex = 0xFFFF_FFFF
    println("一百万: ${million}")
    println("大数: ${largeHex}")
    
    // 类型后缀
    let a = 100i8    // Int8 类型
    let b = 0x10u64  // UInt64 类型
    println("a = ${a}, b = ${b}")
}
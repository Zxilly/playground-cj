main() {
    let a: Int64 = 42
    let b: Int8 = 127
    let c: UInt8 = 255

    // 不同进制表示
    let decimal = 255
    let hex = 0xFF
    let octal = 0o377
    let binary = 0b1111_1111

    println("Int64: ${a}")
    println("Int8: ${b}")
    println("UInt8: ${c}")
    println("十进制: ${decimal}")
    println("十六进制: ${hex}")
    println("八进制: ${octal}")
    println("二进制: ${binary}")
}

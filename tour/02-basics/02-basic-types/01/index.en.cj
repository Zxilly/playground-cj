main() {
    // Decimal literals
    let decimal = 42
    println("Decimal 42 = ${decimal}")

    // Different numeral systems for the same value
    let hex = 0x2A        // Hexadecimal
    let binary = 0b101010  // Binary
    println("Hexadecimal 0x2A = ${hex}")
    println("Binary 0b101010 = ${binary}")

    // Using underscores for readability
    let million = 1_000_000
    println("One million = ${million}")

    // Using suffixes to specify types
    let small: Int8 = 127
    let unsigned: UInt64 = 100u64
    println("Int8: ${small}, UInt64: ${unsigned}")

    // Verify that Int64 is the default type
    let inferred = 999
    println("Inferred type: ${inferred}")
}
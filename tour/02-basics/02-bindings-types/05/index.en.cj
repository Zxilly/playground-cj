main() {
    // Explicit type annotation
    let days: Int64 = 42
    let small: Int8 = 127
    let position: UInt32 = 100u32  // Specify type using suffix

    println("Days: ${days}")
    println("Small integer: ${small}")
    println("Position: ${position}")

    // Literals in different number systems
    let decimal = 42
    let hex = 0x2A          // Hexadecimal
    let binary = 0b101010   // Binary
    let octal = 0o52        // Octal

    println("Decimal: ${decimal}")
    println("Hexadecimal 0x2A: ${hex}")
    println("Binary 0b101010: ${binary}")
    println("Octal 0o52: ${octal}")

    // Underscore separator for readability
    let million = 1_000_000
    let largeHex = 0xFFFF_FFFF
    println("One million: ${million}")
    println("Large number: ${largeHex}")
    
    // Type suffixes
    let a = 100i8    // Int8 type
    let b = 0x10u64  // UInt64 type
    println("a = ${a}, b = ${b}")
}
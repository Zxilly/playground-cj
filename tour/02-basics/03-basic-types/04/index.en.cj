main() {
    // Single character
    let letter: Rune = r'A'
    let digit: Rune = r'7'
    println("Letter: ${letter}")
    println("Digit: ${digit}")

    // Chinese characters
    let chinese: Rune = r'C'
    let greeting: Rune = r'j'
    print("Chinese: ")
    print(chinese)
    print(greeting)
    println()

    // Emoji
    let emoji: Rune = r'🎉'
    println("Emoji: ${emoji}")

    // Escape characters
    let newline: Rune = r'\n'
    let tab: Rune = r'\t'
    let backslash: Rune = r'\\'
    println("Newline code point: ${UInt32(newline)}")
    println("Tab code point: ${UInt32(tab)}")

    // Using escape characters to control output format
    print("Hello")
    print(tab)
    print("World")
    print(newline)

    // Universal characters (Unicode code points)
    let he: Rune = r'\u{4f60}'  // "你"
    let mai: Rune = r'\u{597d}' // "好"
    print("Unicode characters: ")
    print(he)
    print(mai)
    println()

    // Character comparison (comparing Unicode code points)
    println("'A' < 'B': ${r'A' < r'B'}")
    println("'a' > 'A': ${r'a' > r'A'}")

    // Conversion between Rune and UInt32
    let code: UInt32 = UInt32(r'中')
    println("Unicode code point of '中': ${code}")

    let charFromCode = Rune(20013)
    println("Character for code point 20013: ${charFromCode}")
}
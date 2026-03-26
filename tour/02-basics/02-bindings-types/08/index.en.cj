main() {
    // Single character
    let letter: Rune = r'A'
    let chinese: Rune = r'Cang'
    let emoji: Rune = r'🎉'

    println("Letter: ${letter}")
    println("Chinese character: ${chinese}")
    println("Emoji: ${emoji}")

    // Escape characters
    let newline: Rune = r'\n'
    let tab: Rune = r'\t'
    let backslash: Rune = r'\\'

    print("Hello")
    print(tab)
    print("World")
    print(newline)

    // Universal characters (Unicode code points)
    let he: Rune = r'\u{4f60}'   // "你"
    let llo: Rune = r'\u{597d}'  // "好"
    print(he)
    print(llo)
    print(newline)

    // Convert between Rune and UInt32
    let codePoint = UInt32(letter)
    println("Unicode code point of letter A: ${codePoint}")

    let fromCode = Rune(66)  // 'B'
    println("Character for code point 66: ${fromCode}")

    // Code point to character
    let smile = Rune(0x1F600)  // 😀
    println("Smile emoji: ${smile}")

    // Rune supports comparison (compares Unicode values)
    println("'a' < 'z': ${r'a' < r'z'}")
    println("'A' != 'a': ${r'A' != r'a'}")
}
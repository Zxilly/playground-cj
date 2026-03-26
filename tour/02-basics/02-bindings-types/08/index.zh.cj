main() {
    // 单个字符
    let letter: Rune = r'A'
    let chinese: Rune = r'仓'
    let emoji: Rune = r'🎉'

    println("字母: ${letter}")
    println("汉字: ${chinese}")
    println("表情: ${emoji}")

    // 转义字符
    let newline: Rune = r'\n'
    let tab: Rune = r'\t'
    let backslash: Rune = r'\\'

    print("Hello")
    print(tab)
    print("World")
    print(newline)

    // 通用字符（Unicode 码点）
    let he: Rune = r'\u{4f60}'   // "你"
    let llo: Rune = r'\u{597d}'  // "好"
    print(he)
    print(llo)
    print(newline)

    // Rune 与 UInt32 互转
    let codePoint = UInt32(letter)
    println("字母 A 的 Unicode 码点: ${codePoint}")

    let fromCode = Rune(66)  // 'B'
    println("码点 66 对应的字符: ${fromCode}")

    // 码点转换为字符
    let smile = Rune(0x1F600)  // 😀
    println("笑脸表情: ${smile}")

    // Rune 支持比较（比较 Unicode 值）
    println("'a' < 'z': ${r'a' < r'z'}")
    println("'A' != 'a': ${r'A' != r'a'}")
}
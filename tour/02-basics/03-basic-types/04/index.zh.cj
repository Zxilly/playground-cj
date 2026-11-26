main() {
    // 单个字符
    let letter: Rune = r'A'
    let digit: Rune = r'7'
    println("字母: ${letter}")
    println("数字: ${digit}")

    // 中文字符
    let chinese: Rune = r'仓'
    let greeting: Rune = r'好'
    print("中文: ")
    print(chinese)
    print(greeting)
    println()

    // 表情符号
    let emoji: Rune = r'🎉'
    println("表情: ${emoji}")

    // 转义字符
    let newline: Rune = r'\n'
    let tab: Rune = r'\t'
    let backslash: Rune = r'\\'
    println("换行符码点: ${UInt32(newline)}")
    println("制表符码点: ${UInt32(tab)}")

    // 使用转义字符控制输出格式
    print("Hello")
    print(tab)
    print("World")
    print(newline)

    // 通用字符（Unicode 码点）
    let he: Rune = r'\u{4f60}'  // "你"
    let mai: Rune = r'\u{597d}' // "好"
    print("Unicode 字符: ")
    print(he)
    print(mai)
    println()

    // 字符比较（比较 Unicode 码点）
    println("'A' < 'B': ${r'A' < r'B'}")
    println("'a' > 'A': ${r'a' > r'A'}")

    // Rune 与 UInt32 互转
    let code: UInt32 = UInt32(r'中')
    println("'中' 的 Unicode 码点: ${code}")

    let charFromCode = Rune(20013)
    println("码点 20013 对应字符: ${charFromCode}")
}
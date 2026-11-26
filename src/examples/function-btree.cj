package playground

// 示例场景：纯函数与闭包组合构建二叉树遍历逻辑
// 涉及特性：高阶函数、闭包、命名参数与默认 Lambda 参数
func node(value: Rune,
    left!: () -> Unit = {=>}, right!: () -> Unit = {=>}) {
    return { =>
        left()
        print(value)
        right()
    }
}

main() {
    let tree = node(r'A',
        left: node(r'B', left: node(r'C', right: node(r'D'))),
        right: node(r'E', left: node(r'F'), right: node(r'G')))
    tree()
}

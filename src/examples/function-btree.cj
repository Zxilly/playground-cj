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

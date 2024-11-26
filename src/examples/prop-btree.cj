class Node {
    private var value: Int64 = 0
    public Node(private var name: Rune,
        private let left!: ?Node = None,
        private let right!: ?Node = None) {}

    public mut prop param: Int64 {
        set(number) {
            value = number
            println("${name}: ${value}")
            left?.param = number / 2
            right?.param = number / 2
        }
        get() { value }
    }
}

main() {
    var tree = Node(r'A',
        left: Node(r'B', left: Node(r'C', right: Node(r'D'))),
        right: Node(r'E', left: Node(r'F'), right: Node(r'G')))
    println(tree.param)
    tree.param = 128
}

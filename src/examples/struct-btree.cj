package playground

// 示例场景：使用值类型 struct 定义并中序遍历二叉树
// 涉及特性：struct 主构造函数、可选类型 ?Node、命名默认参数
struct Node {
    public Node(var value: Rune,
        let left!: ?Node = None,
        let right!: ?Node = None) {}

    public func traverse(): Unit {
        left?.traverse()
        print(value)
        right?.traverse()
    }
}

main() {
    var tree = Node(r'A',
        left: Node(r'B', left: Node(r'C', right: Node(r'D'))),
        right: Node(r'E', left: Node(r'F'), right: Node(r'G')))
    tree.traverse()
}

package playground

// 示例场景：使用代数数据类型（递归枚举）构建并遍历二叉树
// 涉及特性：enum 带载荷构造器、match 模式匹配、静态成员函数
enum Tree {
    Empty | Leaf(Int64) | Node(Int64, Tree, Tree)

    public func traverse(): Unit {
        match (this) {
            case Empty => ()
            case Leaf(value) => print(value)
            case Node(value, left, right) =>
                left.traverse()
                print(value)
                right.traverse()
        }
    }

    static public func generate(depth: UInt8): Tree {
        if (depth == 1) {
            return Leaf(1)
        }
        return Node(Int64(depth),
            generate(depth - 1), generate(depth - 1))
    }
}

main() {
    let tree = Node(1,
        Node(2, Node(3, Empty, Leaf(4)), Empty),
        Node(5, Leaf(6), Leaf(7)))
    tree.traverse()

    println()
    let fullTree = Tree.generate(5)
    fullTree.traverse()
}

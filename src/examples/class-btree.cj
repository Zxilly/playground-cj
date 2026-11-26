package playground

// 示例场景：使用类继承与多态遍历二叉树（中序与前序混合）
// 涉及特性：open class、继承 <:、方法重写、可选链 ?.、命名默认参数
open class NodeA {
    public NodeA(protected var value: Rune,
        protected let left!: ?NodeA = None,
        protected let right!: ?NodeA = None) {}

    public open func traverse(): Unit {
        left?.traverse()
        print(value)
        right?.traverse()
    }
}

class NodeB <: NodeA {
    public init(value: Rune,
        left!: ?NodeA = None, right!: ?NodeA = None) {
        super(value, left: left, right: right)
    }

    public func traverse(): Unit {
        print(value)
        left?.traverse()
        right?.traverse()
    }
}

main() {
    var tree = NodeA(r'A',
        left: NodeA(r'B', left: NodeA(r'C', right: NodeA(r'D'))),
        right: NodeB(r'E', left: NodeB(r'F'), right: NodeB(r'G')))
    tree.traverse()
}

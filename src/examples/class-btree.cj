package playground

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

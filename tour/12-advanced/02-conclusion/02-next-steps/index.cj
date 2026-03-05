// Final showcase: A mini calculator with extensible operations
import std.collection.*

interface Operation {
    func symbol(): String
    func apply(a: Float64, b: Float64): Float64
}

class Add <: Operation {
    func symbol(): String { return "+" }
    func apply(a: Float64, b: Float64): Float64 { return a + b }
}

class Sub <: Operation {
    func symbol(): String { return "-" }
    func apply(a: Float64, b: Float64): Float64 { return a - b }
}

class Mul <: Operation {
    func symbol(): String { return "*" }
    func apply(a: Float64, b: Float64): Float64 { return a * b }
}

class Div <: Operation {
    func symbol(): String { return "/" }
    func apply(a: Float64, b: Float64): Float64 {
        if (b == 0.0) { return 0.0 }
        return a / b
    }
}

class Calculator {
    let ops: ArrayList<Operation>

    init() {
        this.ops = ArrayList<Operation>()
    }

    func register(op: Operation): Unit {
        this.ops.append(op)
    }

    func compute(a: Float64, b: Float64): Unit {
        for (op in this.ops) {
            let result = op.apply(a, b)
            println("  ${a} ${op.symbol()} ${b} = ${result}")
        }
    }
}

// Extension: add a helper method
extend Float64 {
    func squared(): Float64 {
        return this * this
    }
}

main() {
    let calc = Calculator()
    calc.register(Add())
    calc.register(Sub())
    calc.register(Mul())
    calc.register(Div())

    println("Calculator with ${calc.ops.size} operations:")
    println("Computing 10 and 3:")
    calc.compute(10.0, 3.0)

    println("")
    println("Computing 7.5 and 2.5:")
    calc.compute(7.5, 2.5)

    println("")
    let x = 5.0
    println("${x} squared = ${x.squared()}")

    println("")
    println("Thanks for completing the Cangjie Tour!")
}
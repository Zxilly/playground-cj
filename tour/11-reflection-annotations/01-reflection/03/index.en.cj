import std.reflect.*

// Define a calculator class with various methods
class Calculator {
    // Instance method: add two numbers
    public func add(a: Int64, b: Int64): Int64 {
        return a + b
    }
    
    // Instance method: multiply two numbers
    public func multiply(a: Int64, b: Int64): Int64 {
        return a * b
    }
    
    // Static method: calculate square
    public static func square(n: Int64): Int64 {
        return n * n
    }
}

main(): Unit {
    let calc = Calculator()
    let info = TypeInfo.of(calc)
    let intInfo = TypeInfo.of<Int64>()
    
    println("Reflective method invocation demo:")
    println()
    
    // Reflectively invoke instance method: add
    let addFunc = info.getInstanceFunction("add", intInfo, intInfo)
    let addResult = (addFunc.apply(calc, [10, 20]) as Int64).getOrThrow()
    println("  add(10, 20) = ${addResult}")
    
    // Reflectively invoke instance method: multiply
    let mulFunc = info.getInstanceFunction("multiply", intInfo, intInfo)
    let mulResult = (mulFunc.apply(calc, [5, 6]) as Int64).getOrThrow()
    println("  multiply(5, 6) = ${mulResult}")
    
    // Reflectively invoke static method: square
    let squareFunc = info.getStaticFunction("square", intInfo)
    let squareResult = (squareFunc.apply(TypeInfo.of<Calculator>(), [7]) as Int64).getOrThrow()
    println("  square(7) = ${squareResult}")
    println()
    
    // List all public methods of the type
    println("All public methods of Calculator class:")
    let methods = info.instanceFunctions.toArray()
    for (m in methods) {
        println("  - ${m}")
    }
}
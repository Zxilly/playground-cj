import std.reflect.*

// 定义一个计算器类，包含多种方法
class Calculator {
    // 实例方法：两数相加
    public func add(a: Int64, b: Int64): Int64 {
        return a + b
    }
    
    // 实例方法：两数相乘
    public func multiply(a: Int64, b: Int64): Int64 {
        return a * b
    }
    
    // 静态方法：计算平方
    public static func square(n: Int64): Int64 {
        return n * n
    }
}

main(): Unit {
    let calc = Calculator()
    let info = TypeInfo.of(calc)
    let intInfo = TypeInfo.of<Int64>()
    
    println("反射调用方法演示:")
    println()
    
    // 反射调用实例方法：add
    let addFunc = info.getInstanceFunction("add", intInfo, intInfo)
    let addResult = (addFunc.apply(calc, [10, 20]) as Int64).getOrThrow()
    println("  add(10, 20) = ${addResult}")
    
    // 反射调用实例方法：multiply
    let mulFunc = info.getInstanceFunction("multiply", intInfo, intInfo)
    let mulResult = (mulFunc.apply(calc, [5, 6]) as Int64).getOrThrow()
    println("  multiply(5, 6) = ${mulResult}")
    
    // 反射调用静态方法：square
    let squareFunc = info.getStaticFunction("square", intInfo)
    let squareResult = (squareFunc.apply(TypeInfo.of<Calculator>(), [7]) as Int64).getOrThrow()
    println("  square(7) = ${squareResult}")
    println()
    
    // 列出类型的所有公共方法
    println("Calculator 类的所有公共方法:")
    let methods = info.instanceFunctions.toArray()
    for (m in methods) {
        println("  - ${m}")
    }
}
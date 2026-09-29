import std.collection.ArrayList
import std.math.sqrt

main(): Unit {
    // 使用显式导入的 ArrayList
    let numbers = ArrayList<Int64>()
    numbers.add(10)
    numbers.add(20)
    numbers.add(30)
    numbers.add(40)
    
    println("列表中的元素:")
    for (num in numbers) {
        println("  ${num}")
    }
    
    // 使用导入的数学函数
    let value: Float64 = 16.0
    let root = sqrt(value)
    println("\n${value} 的平方根是 ${root}")
    
    // String, Int64 等类型自动可用（来自隐式导入的 core 包）
    let message: String = "隐式导入的类型无需手动导入"
    println("\n${message}")
}
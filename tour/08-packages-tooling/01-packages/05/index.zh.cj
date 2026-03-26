// 在真实的多包项目中，可以重新导出其他包的声明：
//
//   // 在 mylib 包中：
//   package mylib
//   public import std.collection.ArrayList
//   public import std.math.sqrt
//
// 然后导入 mylib 的代码可以直接使用 ArrayList 和 sqrt，
// 无需单独导入 std.collection 或 std.math
//
// 这称为"重新导出"（re-export），用于构建库的友好 API

import std.collection.ArrayList

// 普通的 private 导入（默认）
// 导入的名称仅在当前文件可用

main(): Unit {
    let numbers = ArrayList<Int64>()
    numbers.append(100)
    numbers.append(200)
    numbers.append(300)
    
    println("重新导出演示:")
    println("数量: ${numbers.size}")
    
    for (num in numbers) {
        println("  元素: ${num}")
    }
    
    println("\n重新导出的应用场景:")
    println("1. 库作者可以整合多个子包的常用类型")
    println("2. 使用者只需导入一个入口包")
    println("3. 方便重构内部包结构而不破坏 API")
}
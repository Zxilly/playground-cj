import std.collection.ArrayList

main(): Int64 {
    // 创建空的 ArrayList
    let numbers = ArrayList<Int64>()
    
    // 在末尾添加元素
    numbers.add(10)
    numbers.add(20)
    numbers.add(30)
    println("添加后：size = ${numbers.size}")
    
    // 在指定位置插入元素
    numbers.add(25, at: 2)  // 在索引 2 处插入 25
    println("插入 25 到位置 2 后：")
    for (i in 0..numbers.size) {
        println("  [${i}] = ${numbers[i]}")
    }
    
    // 通过下标修改元素
    numbers[0] = 11
    println("修改 [0] 为 11 后：${numbers[0]}")
    
    // 删除指定位置的元素
    numbers.remove(at: 1)  // 删除索引 1 的元素
    println("删除位置 1 后：size = ${numbers.size}")
    
    // 遍历所有元素
    println("最终列表：")
    for (number in numbers) {
        println("  ${number}")
    }
    
    return 0
}
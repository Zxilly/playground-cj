import std.collection.ArrayList

main(): Int64 {
    let numbers = ArrayList<Int64>([1, 2, 3, 4, 5])
    println("原始列表：${numbers}")
    
    // 映射（Map）：每个元素求平方
    let squares = ArrayList<Int64>()
    for (number in numbers) {
        squares.add(number * number)
    }
    println("\n映射（平方）后：${squares}")
    
    // 过滤（Filter）：只保留偶数
    let evens = ArrayList<Int64>()
    for (number in numbers) {
        if (number % 2 == 0) {
            evens.add(number)
        }
    }
    println("过滤（偶数）后：${evens}")
    
    // 归约（Reduce）：求所有元素的和
    var sum: Int64 = 0
    for (number in numbers) {
        sum += number
    }
    println("归约（求和）后：${sum}")
    
    // 组合示例：先过滤再映射
    let evenSquares = ArrayList<Int64>()
    for (number in numbers) {
        if (number % 2 == 0) {
            evenSquares.add(number * number)
        }
    }
    println("\n先过滤偶数，再求平方：${evenSquares}")
    
    // 组合示例：先映射再过滤
    let squaresOver5 = ArrayList<Int64>()
    for (number in numbers) {
        let sq = number * number
        if (sq > 5) {
            squaresOver5.add(sq)
        }
    }
    println("先求平方，再过滤 > 5：${squaresOver5}")
    
    return 0
}
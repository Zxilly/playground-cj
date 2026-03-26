main() {
    // 数组字面量创建
    let numbers: Array<Int64> = [10, 20, 30, 40, 50]
    println("第一个元素: ${numbers[0]}")
    println("最后一个元素: ${numbers[numbers.size - 1]}")
    println("数组长度: ${numbers.size}")
    
    // 使用构造函数创建
    let squares = Array<Int64>(5, { i: Int64 => (i + 1) * (i + 1) })
    println("平方数: ${squares}")
    
    // for-in 遍历
    println("遍历数组:")
    for (n in numbers) {
        print("${n} ")
    }
    println("")
    
    // 修改元素值
    numbers[1] = 25
    println("修改后 numbers[1] = ${numbers[1]}")
    
    // Array 是引用类型
    let ref = numbers
    ref[0] = 100
    println("通过 ref 修改后，numbers[0] = ${numbers[0]}")
    
    // 字符串数组
    let fruits = ["苹果", "香蕉", "橙子"]
    println("水果:")
    for (fruit in fruits) {
        println("  - ${fruit}")
    }
}
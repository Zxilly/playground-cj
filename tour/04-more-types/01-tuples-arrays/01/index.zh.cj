main() {
    // 创建元组
    let point: (Int64, Int64) = (3, 4)
    println("点坐标: (${point[0]}, ${point[1]})")
    
    // 元组可以包含不同类型
    let person: (String, Int64, Bool) = ("张三", 25, true)
    println("姓名: ${person[0]}, 年龄: ${person[1]}, 在职: ${person[2]}")
    
    // 元组解构
    let (x, y) = point
    println("解构后: x = ${x}, y = ${y}")
    
    // 使用 var 声明的元组可以整体重新赋值
    var pi = (3.14, "PI")
    println("原始: ${pi[0]}, ${pi[1]}")
    pi = (3.14159, "更精确的 PI")
    println("重新赋值: ${pi[0]}, ${pi[1]}")
    
    // 元组可作为函数返回值，实现多返回值
    let result = divideAndMod(17, 5)
    println("17 ÷ 5 = ${result[0]} 余 ${result[1]}")
}

// 返回商和余数的元组
func divideAndMod(a: Int64, b: Int64): (Int64, Int64) {
    (a / b, a % b)
}
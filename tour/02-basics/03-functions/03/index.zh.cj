// 返回元组：同时返回最小值和最大值
func minMax(arr: Array<Int64>): (Int64, Int64) {
    var minVal = arr[0]
    var maxVal = arr[0]
    
    for (v in arr) {
        if (v < minVal) {
            minVal = v
        }
        if (v > maxVal) {
            maxVal = v
        }
    }
    
    (minVal, maxVal)  // 隐式返回元组
}

// 返回带有名称的元组（仅作为文档标注，不能用于访问）
func getPerson(): (name: String, age: Int64) {
    ("张三", 30)
}

main() {
    let numbers = [5, 2, 8, 1, 9, 3, 7]
    
    // 方式1：通过索引访问元组元素
    let result1 = minMax(numbers)
    println("最小值：${result1[0]}，最大值：${result1[1]}")
    
    // 方式2：使用解构提取到独立变量
    let (minVal, maxVal) = minMax(numbers)
    println("范围：${minVal} 到 ${maxVal}")
    
    // 解构时可以用 _ 忽略不需要的值
    let (_, max) = minMax(numbers)
    println("只关心最大值：${max}")
    
    // 带名称的元组
    let person = getPerson()
    println("姓名：${person[0]}，年龄：${person[1]}")
}
// 在数组中查找目标值的索引
func findIndex(arr: Array<Int64>, target: Int64): Option<Int64> {
    for (i in 0..arr.size) {
        if (arr[i] == target) {
            return Some(i)  // 找到，返回索引
        }
    }
    None  // 未找到
}

// 安全的除法运算
func divide(a: Float64, b: Float64): Option<Float64> {
    if (b == 0.0) {
        None  // 除数为零，返回 None
    } else {
        Some(a / b)
    }
}

main() {
    let numbers = [10, 20, 30, 40, 50]

    // 查找存在的值
    match (findIndex(numbers, 30)) {
        case Some(idx) => 
            println("找到 30，索引为 ${idx}")
        case None => 
            println("未找到 30")
    }

    // 查找不存在的值
    match (findIndex(numbers, 99)) {
        case Some(idx) => 
            println("找到 99，索引为 ${idx}")
        case None => 
            println("未找到 99")
    }

    // 正常除法
    match (divide(10.0, 3.0)) {
        case Some(result) => 
            println("10 / 3 = ${result}")
        case None => 
            println("除法失败")
    }

    // 除以零
    match (divide(10.0, 0.0)) {
        case Some(result) => 
            println("10 / 0 = ${result}")
        case None => 
            println("不能除以零")
    }
}
// 嵌套函数：在函数内部定义的函数

func processNumbers(numbers: Array<Int64>): (Int64, Int64, Int64) {
    // 嵌套函数：计算总和
    func sum(arr: Array<Int64>): Int64 {
        var total = 0
        for (n in arr) {
            total += n
        }
        total
    }
    
    // 嵌套函数：计算平均值
    func average(arr: Array<Int64>): Int64 {
        if (arr.size == 0) {
            0
        } else {
            sum(arr) / arr.size
        }
    }
    
    // 嵌套函数：找出最大值
    func max(arr: Array<Int64>): Int64 {
        if (arr.size == 0) {
            0
        } else {
            var maxVal = arr[0]
            for (n in arr) {
                if (n > maxVal) {
                    maxVal = n
                }
            }
            maxVal
        }
    }
    
    // 嵌套函数可以互相调用
    (sum(numbers), average(numbers), max(numbers))
}

func makeCounter(): () -> Int64 {
    var count = 0
    
    // 嵌套函数可以捕获外层变量
    func increment(): Int64 {
        count = count + 1
        count
    }
    
    increment
}

main() {
    let data = [10, 20, 30, 40, 50]
    let (total, avg, maximum) = processNumbers(data)
    
    println("数据: ${data}")
    println("总和: ${total}")
    println("平均值: ${avg}")
    println("最大值: ${maximum}")
    
    // 嵌套函数作为闭包返回
    let counter = makeCounter()
    println("计数: ${counter()}")  // 1
    println("计数: ${counter()}")  // 2
    println("计数: ${counter()}")  // 3
}
// 嵌套函数：在函数内部定义的函数

class CounterState {
    var count: Int64

    init(count: Int64) {
        this.count = count
    }
}

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
    let state = CounterState(0)
    
    // 嵌套函数捕获不可变引用，其指向对象的成员仍可修改
    func increment(): Int64 {
        state.count = state.count + 1
        state.count
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

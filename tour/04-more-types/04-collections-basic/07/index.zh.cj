import std.collection.ArrayList

func sortAscending(values: ArrayList<Int64>): Unit {
    var i = 0
    while (i < values.size) {
        // 在剩余元素中找最小值的索引
        var minIndex = i
        var j = i + 1
        while (j < values.size) {
            if (values[j] < values[minIndex]) {
                minIndex = j
            }
            j += 1
        }
        
        // 交换当前位置和最小值位置
        if (minIndex != i) {
            let temp = values[i]
            values[i] = values[minIndex]
            values[minIndex] = temp
        }
        
        i += 1
    }
}

main(): Int64 {
    let scores = ArrayList<Int64>([42, 7, 19, 88, 7, 23, 56])
    
    println("排序前：")
    for (score in scores) {
        print("${score} ")
    }
    println()
    
    // 排序
    sortAscending(scores)
    
    println("排序后（升序）：")
    for (score in scores) {
        print("${score} ")
    }
    println()
    
    return 0
}
// 计算 [start, end] 区间内所有整数的和
func sumRange(start: Int64, end: Int64): Int64 {
    var total: Int64 = 0
    var current = start
    while (current <= end) {
        total += current
        current += 1
    }
    return total
}

main() {
    println("计算 1 到 100 的和...")

    // 在新线程中计算前半部分
    let left = spawn {
        sumRange(1, 50)
    }

    // 在另一个新线程中计算后半部分
    let right = spawn {
        sumRange(51, 100)
    }

    // 等待两个线程完成并获取结果
    let leftSum = left.get()
    let rightSum = right.get()
    let total = leftSum + rightSum

    println("左半部分 (1-50): ${leftSum}")
    println("右半部分 (51-100): ${rightSum}")
    println("总和: ${total}")
}
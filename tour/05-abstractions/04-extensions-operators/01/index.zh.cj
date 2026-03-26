// 为 Int64 添加实用函数
extend Int64 {
    // 判断是否为偶数
    func isEven(): Bool {
        return this % 2 == 0
    }

    // 判断是否为正数
    func isPositive(): Bool {
        return this > 0
    }

    // 求绝对值
    func abs(): Int64 {
        if (this < 0) {
            return -this
        }
        return this
    }

    // 判断是否在指定范围内
    func inRange(low: Int64, high: Int64): Bool {
        return this >= low && this <= high
    }
}

main() {
    let numbers = [42, -7, 0, 15, -100]
    
    for (n in numbers) {
        println("数字 ${n}:")
        println("  是偶数: ${n.isEven()}")
        println("  是正数: ${n.isPositive()}")
        println("  绝对值: ${n.abs()}")
        println("  在 0-50 范围内: ${n.inRange(0, 50)}")
        println()
    }
}
main() {
    // 左闭右开区间：0, 1, 2, 3, 4（不包含 5）
    print("0..5: ")
    for (i in 0..5) {
        print("${i} ")
    }
    println("")
    
    // 左闭右闭区间：0, 1, 2, 3, 4, 5（包含 5）
    print("0..=5: ")
    for (i in 0..=5) {
        print("${i} ")
    }
    println("")
    
    // 指定步长
    print("0..10 步长为 2: ")
    for (i in 0..10 : 2) {
        print("${i} ")
    }
    println("")
    
    // 递减区间：步长为负数
    print("10..=0 步长为 -2: ")
    for (i in 10..=0 : -2) {
        print("${i} ")
    }
    println("")
    
    // 空区间：步长方向与区间方向矛盾
    var count = 0
    for (_ in 10..0 : 1) {  // 步长为正，但 10 > 0
        count++  // 这行不会执行
    }
    println("空区间循环体执行次数: ${count}")
    
    // 应用：计算 1 到 100 的和
    var sum = 0
    for (i in 1..=100) {
        sum += i
    }
    println("1 到 100 的和: ${sum}")
}
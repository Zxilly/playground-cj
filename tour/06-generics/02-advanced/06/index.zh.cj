// 定义支持编译期构造的结构体
struct Point {
    const Point(let x: Float64, let y: Float64) {}
}

// const 函数：可以在编译期求值
// 计算两点之间的欧氏距离
const func distance(a: Point, b: Point): Float64 {
    let dx = a.x - b.x
    let dy = a.y - b.y
    (dx ** 2 + dy ** 2) ** 0.5
}

// const 函数：计算平方和
const func sumSquares(n: Int64): Int64 {
    var total = 0
    var i = 1
    while (i <= n) {
        total += i * i
        i += 1
    }
    total
}

// const 函数：阶乘
const func factorial(n: Int64): Int64 {
    if (n <= 1) {
        1
    } else {
        n * factorial(n - 1)
    }
}

main() {
    // 编译期创建点和计算距离
    const a = Point(3.0, 0.0)      // 编译期构造
    const b = Point(0.0, 4.0)      // 编译期构造
    const d = distance(a, b)       // 编译期计算，结果是 5.0
    
    println("=== 编译期求值 ===")
    println("点 A: (${a.x}, ${a.y})")
    println("点 B: (${b.x}, ${b.y})")
    println("距离: ${d}")

    // 编译期计算数学值
    const sum = sumSquares(10)      // 1² + 2² + ... + 10²
    const fact = factorial(10)      // 10!
    
    println("\n=== 编译期数学计算 ===")
    println("1到10的平方和: ${sum}")
    println("10的阶乘: ${fact}")

    // const 函数也可以在运行时调用
    println("\n=== 运行时计算 ===")
    let p1 = Point(1.0, 2.0)        // 运行时构造
    let p2 = Point(4.0, 6.0)        // 运行时构造
    let dist = distance(p1, p2)     // 运行时计算
    println("运行时距离: ${dist}")
}
main() {
    let point = (1, 0)

    match (point) {
        case (0, 0) => println("原点")
        case (x, 0) => println("在 x 轴上, x = ${x}")
        case (0, y) => println("在 y 轴上, y = ${y}")
        case (x, y) => println("点 (${x}, ${y})")
    }

    // Combining value and binding patterns
    let record = ("Alice", 95)
    match (record) {
        case (name, 100) => println("${name} 获得了满分！")
        case (name, score) => println("${name} 的分数: ${score}")
    }
}

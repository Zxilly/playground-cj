main() {
    let point = (1, 0)

    // 元组模式：匹配和解构坐标
    match (point) {
        case (0, 0) => println("这是原点")
        case (x, 0) => println("在 x 轴上, x = ${x}")
        case (0, y) => println("在 y 轴上, y = ${y}")
        case (x, y) => println("坐标点 (${x}, ${y})")
    }

    // 结合值模式和绑定模式
    let record = ("Alice", 95)
    match (record) {
        case (name, 100) => println("${name} 获得了满分！")
        case (name, score) => println("${name} 的分数: ${score}")
    }

    // 三元组匹配
    let rgb = (255, 128, 0)
    match (rgb) {
        case (255, 255, 255) => println("白色")
        case (0, 0, 0) => println("黑色")
        case (r, g, b) => println("RGB(${r}, ${g}, ${b})")
    }
}
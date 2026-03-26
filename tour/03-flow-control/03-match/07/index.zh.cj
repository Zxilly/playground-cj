enum Direction {
    | North | South | East | West
}

main() {
    let dir = Direction.North

    // enum 必须穷尽所有构造器 —— 不需要 _ 分支
    let label = match (dir) {
        case North => "北"
        case South => "南"
        case East => "东"
        case West => "西"
    }
    println("方向: ${label}")

    // 对于 Int64 等开放类型，必须用 _ 或绑定模式
    let x = 42
    match (x) {
        case 0 => println("零")
        case 1 => println("一")
        case n => println("其他值: ${n}")  // 绑定模式覆盖剩余情况
    }

    // 绑定模式也能确保穷尽性
    let code = 404
    let description = match (code) {
        case 200 => "成功"
        case 404 => "未找到"
        case 500 => "服务器错误"
        case other => "状态码: ${other}"  // 处理所有其他值
    }
    println(description)
}
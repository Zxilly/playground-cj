enum Direction {
    | North | South | East | West
}

main() {
    let dir = Direction.North

    // 穷举所有 enum 构造器 —— 不需要 _ 分支
    let label = match (dir) {
        case North => "北"
        case South => "南"
        case East => "东"
        case West => "西"
    }
    println("方向: ${label}")

    // 对于 Int64 等类型，用 _ 或绑定模式确保穷尽
    let x = 42
    match (x) {
        case 0 => println("零")
        case 1 => println("一")
        case other => println("其他值: ${other}")
    }
}

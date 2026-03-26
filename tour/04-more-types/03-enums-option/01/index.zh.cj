// 定义一个表示方向的枚举类型
enum Direction {
    | North
    | South
    | East
    | West
}

// 使用 match 表达式处理枚举的所有情况
func describe(dir: Direction): String {
    match (dir) {
        case North => "向北走"
        case South => "向南走"
        case East => "向东走"
        case West => "向西走"
    }
}

main() {
    // 通过 类型名.构造器 创建枚举值
    let dir1 = Direction.North
    let dir2 = Direction.West
    
    // 直接使用构造器名（无命名冲突时）
    let dir3 = South
    
    println("方向1: ${describe(dir1)}")
    println("方向2: ${describe(dir2)}")
    println("方向3: ${describe(dir3)}")
}
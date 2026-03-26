// 定义带数据的枚举：不同形状携带不同的参数
enum Shape {
    | Circle(Float64)              // 圆：半径
    | Rectangle(Float64, Float64)  // 矩形：宽和高
    | Triangle(Float64, Float64)   // 三角形：底和高
}

// 计算形状的面积
func area(s: Shape): Float64 {
    match (s) {
        case Circle(r) => 
            3.14159 * r * r
        case Rectangle(w, h) => 
            w * h
        case Triangle(b, h) => 
            0.5 * b * h
    }
}

// 生成形状的描述字符串
func describe(s: Shape): String {
    match (s) {
        case Circle(r) => 
            "圆(半径=${r})"
        case Rectangle(w, h) => 
            "矩形(${w} x ${h})"
        case Triangle(b, h) => 
            "三角形(底=${b}, 高=${h})"
    }
}

main() {
    // 创建不同形状的实例
    let shapes = [
        Shape.Circle(5.0),
        Shape.Rectangle(4.0, 6.0),
        Shape.Triangle(3.0, 8.0)
    ]

    // 遍历并输出每个形状的信息
    for (s in shapes) {
        let desc = describe(s)
        let a = area(s)
        println("${desc}, 面积 = ${a}")
    }
}
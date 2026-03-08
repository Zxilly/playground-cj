main() {
    let code = 404

    match (code) {
        case 200 => println("成功")
        case 301 => println("重定向")
        case 404 => println("未找到")
        case other => println("其他状态码: ${other}")
    }

    // Binding pattern to capture the matched value
    let score = 75
    let result = match (score) {
        case 100 => "满分！"
        case n => "你的分数是 ${n}"
    }
    println(result)
}

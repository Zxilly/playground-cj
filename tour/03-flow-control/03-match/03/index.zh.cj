main() {
    let code = 404

    // 绑定模式：捕获匹配的值
    match (code) {
        case 200 => println("请求成功")
        case 301 => println("永久重定向")
        case 404 => println("资源未找到")
        case other => println("收到状态码: ${other}")  // 绑定任何其他值
    }

    // 绑定模式可以返回使用该值的结果
    let score = 75
    let result = match (score) {
        case 100 => "满分！"
        case 0 => "零分"
        case n => "得分: ${n}"  // 使用绑定的值
    }
    println(result)

    // 绑定模式在处理剩余情况时很有用
    let count = 3
    match (count) {
        case 0 => println("没有项目")
        case 1 => println("一个项目")
        case n => println("${n} 个项目")  // 绑定并显示
    }
}
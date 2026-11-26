main() {
    // 定义可变绑定
    var count = 0
    println("初始值: ${count}")
    
    // 可以多次修改 var 变量的值
    count = 10
    println("第一次修改: ${count}")
    
    count = count + 5
    println("第二次修改: ${count}")
    
    // 另一个可变绑定示例
    var message = "hello"
    message = "world"  // 可以修改
    println("消息: ${message}")
    
    // 不支持链式赋值：
    // var a = 0
    // var b = 0
    // a = b = 1  // 语法错误
}
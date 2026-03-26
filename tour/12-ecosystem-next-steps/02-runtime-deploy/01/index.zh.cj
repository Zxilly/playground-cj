// 编译此文件: cjc hello.cj -o hello
// 然后运行:   ./hello

main() {
    println("欢迎使用仓颉编程语言!")
    println("这是一个编译为原生二进制的程序。")
    
    // 简单计算示例
    let sum = 0
    for (i in 1..=10) {
        sum += i
    }
    println("1 到 10 的和是: ${sum}")
    
    // 展示字符串插值
    let language = "仓颉"
    let year = 2024
    println("${language} 语言, ${year} 年")
}
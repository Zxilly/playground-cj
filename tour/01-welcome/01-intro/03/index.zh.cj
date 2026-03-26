// 文件名: hello.cj
// 编译命令: cjc hello.cj -o hello
main() {
    let target = "本地环境"
    let status = "正常"
    
    println("正在 ${target} 运行...")
    println("编译器状态: ${status}")
    
    // 简单的数学运算
    let a = 10
    let b = 20
    println("计算结果: ${a} + ${b} = ${a + b}")
}
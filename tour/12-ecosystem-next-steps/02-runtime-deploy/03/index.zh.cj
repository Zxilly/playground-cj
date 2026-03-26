// CJNative 后端编译:
//   cjc backend_demo.cj -o backend_demo
//
// CJVM 后端编译（需要 CJVM SDK）:
//   cjc backend_demo.cj -o backend_demo

// 根据后端类型定义不同的函数
@When[backend == "cjnative"]
func getBackendInfo(): String {
    "CJNative 原生后端 - 直接编译为机器码"
}

@When[backend == "cjvm"]
func getBackendInfo(): String {
    "CJVM 后端 - 编译为 JVM 字节码"
}

// 通用的后端无关代码
func calculateSequence(n: Int64): Int64 {
    var result = 0
    for (i in 1..=n) {
        result += i * i
    }
    result
}

main() {
    println("=== 编译后端演示 ===")
    
    // 输出当前使用的后端
    println("当前后端: ${getBackendInfo()}")
    
    // 执行通用计算
    let n = 10
    let sum = calculateSequence(n)
    println("1² 到 ${n}² 的和: ${sum}")
    
    // 展示架构信息
    @When[arch == "x86_64"]
    println("运行平台: x86_64")
    
    @When[arch == "aarch64"]
    println("运行平台: aarch64")
    
    println("程序运行完成!")
}
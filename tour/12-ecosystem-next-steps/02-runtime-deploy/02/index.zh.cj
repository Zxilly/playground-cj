// 动态链接编译（默认）:
//   cjc runtime_check.cj -o runtime_check
//   export LD_LIBRARY_PATH=$CANGJIE_HOME/runtime/lib/linux_x86_64_cjnative:$LD_LIBRARY_PATH
//   ./runtime_check
//
// 静态链接编译（仅 Linux）:
//   cjc runtime_check.cj -o runtime_check --static
//   ./runtime_check

main() {
    println("=== 仓颉运行时检查 ===")
    
    // 测试基本数据类型操作
    let nums = [10, 20, 30, 40, 50]
    var total = 0
    for (n in nums) {
        total += n
    }
    println("数组元素总和: ${total}")
    
    // 测试字符串操作（依赖运行时）
    let text = "仓颉运行时"
    println("字符串长度: ${text.size}")
    println("字符串内容: ${text}")
    
    // 测试对象创建（依赖内存管理）
    class Point {
        let x: Int64
        let y: Int64
        init(x: Int64, y: Int64) {
            this.x = x
            this.y = y
        }
    }
    let p = Point(100, 200)
    println("坐标点: (${p.x}, ${p.y})")
    
    println("运行时检查完成，一切正常!")
}
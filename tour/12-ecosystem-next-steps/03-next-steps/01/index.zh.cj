// 保存为 hello.cj 文件
// 编译命令: cjc hello.cj
// 运行命令: ./main (Linux/macOS) 或 main.exe (Windows)

main() {
    println("=== 仓颉 Tour 毕业生 ===")
    println("你已经学会了：")
    
    let skills = [
        "基础语法与类型系统",
        "函数与闭包",
        "类、接口与泛型",
        "错误处理",
        "并发编程",
        "集合与迭代器"
    ]
    
    var count = 1
    for (skill in skills) {
        println("  ${count}. ${skill}")
        count++
    }
    
    println("\n下一步：创建自己的项目，探索标准库！")
}
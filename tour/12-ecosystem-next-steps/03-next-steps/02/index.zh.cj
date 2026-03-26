// cjpm 创建的项目示例
// 项目结构:
// my_project/
// ├── cjpm.toml        # 项目配置文件
// └── src/
//     └── main.cj      # 主程序入口

// cjpm.toml 内容示例:
// [package]
//   cjc-version = "1.0.0"
//   name = "my_project"
//   version = "1.0.0"
//   output-type = "executable"
//
// [dependencies]
//   // 在此添加第三方依赖

// src/main.cj 内容:
package my_project

main(): Int64 {
    println("项目名称: my_project")
    println("版本: 1.0.0")
    
    // 实际项目中可以使用更多功能
    let numbers = [10, 20, 30, 40, 50]
    var sum = 0
    for (n in numbers) {
        sum += n
    }
    
    println("数字总和: ${sum}")
    println("平均值: ${sum / numbers.size}")
    
    return 0
}

// 常用 cjpm 命令:
// cjpm init       创建新项目
// cjpm build      编译项目
// cjpm run        编译并运行
// cjpm test       运行测试
// cjpm clean      清理构建产物
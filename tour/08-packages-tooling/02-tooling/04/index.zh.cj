// 工作区是多模块项目的组织方式
//
// 工作区根目录的 cjpm.toml：
//
//   [workspace]
//     members = ["app", "utils"]   // 成员模块列表
//     build-members = ["app"]      // 指定编译模块
//     test-members = ["utils"]     // 指定测试模块
//
// 典型的目录结构：
//
//   myworkspace/
//     ├── cjpm.toml         （工作区配置）
//     ├── app/
//     │   ├── cjpm.toml     （应用模块配置）
//     │   └── src/
//     │       └── main.cj
//     └── utils/
//         ├── cjpm.toml     （工具模块配置）
//         └── src/
//             └── lib.cj
//
// 在工作区根目录运行：
//   cjpm build    - 编译所有成员模块
//   cjpm run      - 运行可执行模块

main(): Unit {
    println("工作区示例")
    println("=========")
    
    let module1 = "app"
    let module2 = "utils"
    
    println("成员模块 1: ${module1}")
    println("成员模块 2: ${module2}")
    println("\n工作区可以统一管理多个相关模块")
}
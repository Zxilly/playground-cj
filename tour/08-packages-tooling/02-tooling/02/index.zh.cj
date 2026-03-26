// 运行 `cjpm init` 后生成的项目结构：
//
//   myproject/
//     ├── cjpm.toml        （项目配置文件）
//     └── src/
//         └── main.cj      （入口文件）
//
// cjpm.toml 的典型内容：
//
//   [package]
//     cjc-version = "1.0.0"   // 所需 cjc 最低版本
//     name = "myproject"      // 模块名称
//     version = "1.0.0"       // 模块版本
//     output-type = "executable"  // 输出类型
//     description = "My first Cangjie project"
//
//   [dependencies]           // 依赖项（可选）
//
// 初始化项目后，可以使用 `cjpm build` 编译，
// 或 `cjpm run` 直接编译并运行

main(): Unit {
    println("Hello from cjpm project!")
    println("项目结构已创建完成")
    
    let project = "myproject"
    let version = "1.0.0"
    println("项目: ${project}, 版本: ${version}")
}
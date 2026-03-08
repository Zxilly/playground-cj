// 工作区的 cjpm.toml 如下所示：
//
//   [workspace]
//     members = ["app", "utils"]
//
// 目录结构：
//   myworkspace/
//     cjpm.toml          （工作区配置）
//     app/
//       cjpm.toml        （模块配置）
//       src/main.cj
//     utils/
//       cjpm.toml        （模块配置）
//       src/lib.cj

main(): Unit {
    println("This module is part of a workspace!")
}

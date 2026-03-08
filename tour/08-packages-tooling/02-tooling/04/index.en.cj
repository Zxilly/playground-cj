// A workspace cjpm.toml looks like:
//
//   [workspace]
//     members = ["app", "utils"]
//
// Directory structure:
//   myworkspace/
//     cjpm.toml          (workspace config)
//     app/
//       cjpm.toml        (module config)
//       src/main.cj
//     utils/
//       cjpm.toml        (module config)
//       src/lib.cj

main(): Unit {
    println("This module is part of a workspace!")
}

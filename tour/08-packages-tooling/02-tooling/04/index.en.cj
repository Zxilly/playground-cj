// Workspace is a way to organize multi-module projects
//
// cjpm.toml in workspace root directory:
//
//   [workspace]
//     members = ["app", "utils"]   // member module list
//     build-members = ["app"]      // specify build modules
//     test-members = ["utils"]     // specify test modules
//
// Typical directory structure:
//
//   myworkspace/
//     ├── cjpm.toml         (workspace configuration)
//     ├── app/
//     │   ├── cjpm.toml     (application module configuration)
//     │   └── src/
//     │       └── main.cj
//     └── utils/
//         ├── cjpm.toml     (utility module configuration)
//         └── src/
//             └── lib.cj
//
// Run in workspace root directory:
//   cjpm build    - compile all member modules
//   cjpm run      - run executable modules

main(): Unit {
    println("Workspace Example")
    println("=========")
    
    let module1 = "app"
    let module2 = "utils"
    
    println("Member module 1: ${module1}")
    println("Member module 2: ${module2}")
    println("\nWorkspaces can unifiedly manage multiple related modules")
}
// Project structure generated after running `cjpm init`:
//
//   myproject/
//     ├── cjpm.toml        (project configuration file)
//     └── src/
//         └── main.cj      (entry file)
//
// Typical content of cjpm.toml:
//
//   [package]
//     cjc-version = "1.0.0"   // required minimum cjc version
//     name = "myproject"      // module name
//     version = "1.0.0"       // module version
//     output-type = "executable"  // output type
//     description = "My first Cangjie project"
//
//   [dependencies]           // dependencies (optional)
//
// After initializing the project, you can use `cjpm build` to compile,
// or `cjpm run` to directly compile and run

main(): Unit {
    println("Hello from cjpm project!")
    println("Project structure has been created")
    
    let project = "myproject"
    let version = "1.0.0"
    println("Project: ${project}, Version: ${version}")
}
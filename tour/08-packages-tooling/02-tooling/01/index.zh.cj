// 编译此文件：
//   cjc hello.cj            （输出默认文件名 main）
//   cjc hello.cj -o hello   （指定输出文件名）
// 运行：
//   ./main  或  ./hello

main(): Unit {
    println("Hello, Cangjie!")
    println("Compiled with cjc!")
    
    let message = "欢迎使用仓颉编译器"
    println(message)
}
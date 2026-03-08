// 包声明必须与目录路径匹配。
// 对于 src/myapp/ 下的文件，使用：package myapp
// src/ 根目录下的文件可以省略声明。

// 此文件位于根目录，因此无需包声明。

func greet(): String {
    "Hello from the default package!"
}

main(): Unit {
    println(greet())
}

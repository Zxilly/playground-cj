// 定义一个表示二维点的结构体
struct Point {
    let x: Float64
    let y: Float64
}

// 定义一个表示图书的结构体
struct Book {
    let title: String    // 不可变字段
    var pages: Int64     // 可变字段
}

main() {
    // 创建结构体实例
    let point = Point(3.0, 4.0)
    let book = Book("仓颉实战", 180)

    // 访问字段
    println("点坐标: (${point.x}, ${point.y})")
    println("书名: ${book.title}, 页数: ${book.pages}")

    // 可变字段可以修改
    var myBook = Book("仓颉入门", 200)
    myBook.pages = 250
    println("更新后页数: ${myBook.pages}")
}
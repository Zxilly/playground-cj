struct Point {
    let x: Float64
    let y: Float64
}

struct Book {
    let title: String
    let pages: Int64
}

main() {
    let point = Point(3.0, 4.0)
    let book = Book("仓颉实战", 180)

    println("点坐标: (${point.x}, ${point.y})")
    println("书名: ${book.title}, 页数: ${book.pages}")
}

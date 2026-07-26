// Define a struct representing a 2D point
struct Point {
    let x: Float64
    let y: Float64

    public init(x: Float64, y: Float64) {
        this.x = x
        this.y = y
    }
}

// Define a struct representing a book
struct Book {
    let title: String    // immutable field
    var pages: Int64     // mutable field

    public init(title: String, pages: Int64) {
        this.title = title
        this.pages = pages
    }
}

main() {
    // Create struct instances
    let point = Point(3.0, 4.0)
    let book = Book("Cangjie in Action", 180)

    // Access fields
    println("Point coordinates: (${point.x}, ${point.y})")
    println("Book title: ${book.title}, Pages: ${book.pages}")

    // Mutable fields can be modified
    var myBook = Book("Cangjie Primer", 200)
    myBook.pages = 250
    println("Updated pages: ${myBook.pages}")
}

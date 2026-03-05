interface Printable {
    func display(): String
}

interface Describable {
    func describe(): String

    // Interface with default implementation
    func summary(): String {
        "Summary: ${describe()}"
    }
}

class Book <: Printable & Describable {
    let title: String
    let author: String

    init(title: String, author: String) {
        this.title = title
        this.author = author
    }

    func display(): String {
        "[${title}]"
    }

    func describe(): String {
        "\"${title}\" by ${author}"
    }
}

main() {
    let book = Book("The Art of Programming", "Alice")
    println(book.display())
    println(book.describe())
    println(book.summary())  // uses default implementation
}
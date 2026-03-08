interface Printable {
    func display(): String
}

class Student <: Printable {
    let name: String
    let grade: Int64

    init(name: String, grade: Int64) {
        this.name = name
        this.grade = grade
    }

    public func display(): String {
        return "${name} (Grade ${grade})"
    }
}

class Course <: Printable {
    let title: String

    init(title: String) {
        this.title = title
    }

    public func display(): String {
        return "Course: ${title}"
    }
}

// T must implement Printable
func printItem<T>(item: T): Unit where T <: Printable {
    println(item.display())
}

func printAll<T>(items: Array<T>): Unit where T <: Printable {
    for (item in items) {
        println("- ${item.display()}")
    }
}

main() {
    let s = Student("Alice", 3)
    printItem(s)

    let c = Course("Cangjie Programming")
    printItem(c)

    let students = [Student("Bob", 1), Student("Carol", 2)]
    printAll(students)
}

// Define a printable interface
interface Printable {
    func display(): String
}

// Student class implements Printable interface
class Student <: Printable {
    let name: String
    let grade: Int64

    init(name: String, grade: Int64) {
        this.name = name
        this.grade = grade
    }

    public func display(): String {
        "${name} (Grade ${grade})"
    }
}

// Course class implements Printable interface
class Course <: Printable {
    let title: String

    init(title: String) {
        this.title = title
    }

    public func display(): String {
        "Course: ${title}"
    }
}

// Generic function, T must implement Printable interface
func printItem<T>(item: T): Unit where T <: Printable {
    println(item.display())
}

// Generic function that processes arrays, each element must implement Printable
func printAll<T>(items: Array<T>): Unit where T <: Printable {
    println("List contents:")
    for (item in items) {
        println("  - ${item.display()}")
    }
}

main() {
    // Can pass any type that implements Printable
    let student = Student("Zhang San", 3)
    printItem(student)

    let course = Course("Cangjie Programming Language")
    printItem(course)

    // Arrays can also be processed
    let students = [
        Student("Li Si", 1),
        Student("Wang Wu", 2),
        Student("Zhao Liu", 3)
    ]
    printAll(students)
}
// 定义一个可打印接口
interface Printable {
    func display(): String
}

// 学生类实现 Printable 接口
class Student <: Printable {
    let name: String
    let grade: Int64

    init(name: String, grade: Int64) {
        this.name = name
        this.grade = grade
    }

    public func display(): String {
        "${name} (年级 ${grade})"
    }
}

// 课程类实现 Printable 接口
class Course <: Printable {
    let title: String

    init(title: String) {
        this.title = title
    }

    public func display(): String {
        "课程: ${title}"
    }
}

// 泛型函数，T 必须实现 Printable 接口
func printItem<T>(item: T): Unit where T <: Printable {
    println(item.display())
}

// 泛型函数处理数组，每个元素都必须实现 Printable
func printAll<T>(items: Array<T>): Unit where T <: Printable {
    println("列表内容:")
    for (item in items) {
        println("  - ${item.display()}")
    }
}

main() {
    // 可以传入任何实现了 Printable 的类型
    let student = Student("张三", 3)
    printItem(student)

    let course = Course("仓颉编程语言")
    printItem(course)

    // 数组也可以处理
    let students = [
        Student("李四", 1),
        Student("王五", 2),
        Student("赵六", 3)
    ]
    printAll(students)
}
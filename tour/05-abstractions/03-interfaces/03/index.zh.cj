interface Flyable {
    func fly(): String
}

class Bird <: Flyable {
    public func fly(): String {
        "bird flying"
    }
}

class Airplane <: Flyable {
    public func fly(): String {
        "airplane flying"
    }
}

func launch(item: Flyable) {
    println(item.fly())
}

main() {
    launch(Bird())
    launch(Airplane())
}

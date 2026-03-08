func printValue(value: Any) {
    match (value) {
        case i: Int64 => println("Integer: ${i}")
        case s: String => println("String: ${s}")
        case b: Bool => println("Bool: ${b}")
        case _ => println("Unknown type")
    }
}

class Box {
    let value: Any

    init(value: Any) {
        this.value = value
    }

    func describe(): String {
        match (value) {
            case i: Int64 => "Box<Int64>(${i})"
            case s: String => "Box<String>(${s})"
            case _ => "Box(?)"
        }
    }
}

main() {
    // Any can hold any type
    printValue(42)
    printValue("hello")
    printValue(true)

    println("---")

    let boxes = [
        Box(100),
        Box("world"),
        Box(false)
    ]

    for (b in boxes) {
        println(b.describe())
    }
}
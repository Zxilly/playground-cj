// Any can hold values of any type
func printValue(value: Any) {
    match (value) {
        case i: Int64 => 
            println("Integer: ${i}, squared: ${i * i}")
        case f: Float64 =>
            println("Float: ${f}, rounded: ${f}")
        case s: String =>
            println("String: \"${s}\", length: ${s.size}")
        case b: Bool =>
            println("Boolean: ${b}, negated: ${!b}")
        case _ => 
            println("Value of other type")
    }
}

// Flexible data container
class Box {
    let value: Any

    init(value: Any) {
        this.value = value
    }

    func describe(): String {
        match (value) {
            case i: Int64 => "Integer box[${i}]"
            case s: String => "String box[${s}]"
            case arr: Array<Any> => "Box array, length ${arr.size}"
            case _ => "Unknown box"
        }
    }

    // Try to get integer value
    func getInt(): Option<Int64> {
        match (value) {
            case i: Int64 => Some(i)
            case _ => None
        }
    }
}

// Process mixed type data
func sumNumbers(values: Array<Any>) {
    var total: Int64 = 0
    for (v in values) {
        match (v) {
            case i: Int64 => total += i
            case f: Float64 => total += Int64(f)
            case _ => ()  // Ignore non-numeric values
        }
    }
    println("Total: ${total}")
}

main() {
    println("=== Any Type Demo ===\n")

    // Any can hold any value
    printValue(42)
    printValue(3.14159)
    printValue("Hello, Cangjie")
    printValue(true)
    printValue(Dog())  // Custom type

    // Mixed storage of variable-length data
    println("\n=== Mixed Data Container ===")
    let mixed: Array<Any> = [
        42, "hello", 3.14, true, [1, 2, 3]
    ]
    
    println("Iterate mixed array:")
    for (item in mixed) {
        printValue(item)
    }

    // Box container example
    println("\n=== Box Container ===")
    let box1 = Box(123)
    let box2 = Box("Cangjie Language")
    println(box1.describe())
    println(box2.describe())

    if (let Some(n) <- box1.getInt()) {
        println("Extracted integer: ${n}")
    }

    // Sum numbers
    println("\n=== Mixed Type Sum ===")
    let numbers: Array<Any> = [10, 20.5, 30, "not a number", 15, 4.0]
    sumNumbers(numbers)
}

// Helper class
class Dog {
    public func toString(): String {
        "A dog"
    }
}
interface Describable {
    func describe(): String
}

extend Int64 <: Describable {
    func describe(): String {
        if (this > 0) {
            return "${this} is a positive integer"
        } else if (this < 0) {
            return "${this} is a negative integer"
        }
        return "zero"
    }
}

extend Bool <: Describable {
    func describe(): String {
        if (this) {
            return "true - affirmative"
        }
        return "false - negative"
    }
}

func printDescription(item: Describable): Unit {
    println(item.describe())
}

main() {
    printDescription(42)
    printDescription(-3)
    printDescription(0)
    printDescription(true)
    printDescription(false)
}
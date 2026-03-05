interface Displayable {
    func display(): String
}

interface Comparable<T> {
    func compareTo(other: T): Int64
}

class Score <: Displayable & Comparable<Score> {
    let value: Int64

    init(value: Int64) {
        this.value = value
    }

    public func display(): String {
        return "Score(${value})"
    }

    public func compareTo(other: Score): Int64 {
        return this.value - other.value
    }
}

// Multiple constraints using where clause
func findMax<T>(a: T, b: T): T where T <: Comparable<T> {
    if (a.compareTo(b) > 0) {
        return a
    }
    return b
}

// Multiple constraints on same type
func showMax<T>(a: T, b: T): Unit where T <: Comparable<T>, T <: Displayable {
    let max = findMax(a, b)
    println("Max is: ${max.display()}")
}

main() {
    let s1 = Score(85)
    let s2 = Score(92)

    println("s1: ${s1.display()}")
    println("s2: ${s2.display()}")
    showMax(s1, s2)

    let s3 = Score(78)
    showMax(s2, s3)
}
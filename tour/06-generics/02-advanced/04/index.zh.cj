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
        "Score(${value})"
    }

    public func compareTo(other: Score): Int64 {
        value - other.value
    }
}

func findMax<T>(a: T, b: T): T where T <: Comparable<T> {
    if (a.compareTo(b) > 0) {
        a
    } else {
        b
    }
}

func showMax<T>(a: T, b: T) where T <: Comparable<T> & Displayable {
    let max = findMax(a, b)
    println(max.display())
}

main() {
    showMax(Score(85), Score(92))
}

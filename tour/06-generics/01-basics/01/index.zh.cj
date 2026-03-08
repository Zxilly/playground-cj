func pickFirst<T>(left: T, _: T): T {
    left
}

func swap<T, U>(pair: (T, U)): (U, T) {
    let (first, second) = pair
    (second, first)
}

main() {
    println(pickFirst<Int64>(10, 20))

    let (age, label) = swap<String, Int64>(("age", 18))
    println(age)
    println(label)
}

enum Result<T, E> {
    | Ok(T)
    | Err(E)
}

func show(result: Result<Int64, String>) {
    match (result) {
        case Ok(value) => println("value = ${value}")
        case Err(message) => println("error = ${message}")
    }
}

main() {
    show(Ok<Int64, String>(100))
    show(Err<Int64, String>("division by zero"))
}

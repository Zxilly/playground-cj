enum Result<T, E> {
    | Ok(T)
    | Err(E)
}

func divide(a: Float64, b: Float64): Result<Float64, String> {
    if (b == 0.0) {
        return Err("Division by zero")
    }
    return Ok(a / b)
}

func showResult<T, E>(r: Result<T, E>): Unit {
    match (r) {
        case Ok(v) => println("Success: ${v}")
        case Err(e) => println("Error: ${e}")
    }
}

main() {
    let r1 = divide(10.0, 3.0)
    showResult(r1)

    let r2 = divide(5.0, 0.0)
    showResult(r2)

    // Option is also a generic enum
    let some: Option<Int64> = Some(42)
    let none: Option<Int64> = None
    match (some) {
        case Some(v) => println("Got value: ${v}")
        case None => println("No value")
    }
    match (none) {
        case Some(v) => println("Got value: ${v}")
        case None => println("No value")
    }
}
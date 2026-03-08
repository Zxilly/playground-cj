func findIndex(arr: Array<Int64>, target: Int64): Option<Int64> {
    for (i in 0..arr.size) {
        if (arr[i] == target) {
            return Some(i)
        }
    }
    None
}

func divide(a: Float64, b: Float64): Option<Float64> {
    if (b == 0.0) {
        None
    } else {
        Some(a / b)
    }
}

main() {
    let numbers = [10, 20, 30, 40, 50]

    match (findIndex(numbers, 30)) {
        case Some(idx) => println("Found 30 at index ${idx}")
        case None => println("30 not found")
    }

    match (findIndex(numbers, 99)) {
        case Some(idx) => println("Found 99 at index ${idx}")
        case None => println("99 not found")
    }

    match (divide(10.0, 3.0)) {
        case Some(result) => println("10 / 3 = ${result}")
        case None => println("Cannot divide by zero")
    }

    match (divide(10.0, 0.0)) {
        case Some(result) => println("10 / 0 = ${result}")
        case None => println("Cannot divide by zero")
    }
}
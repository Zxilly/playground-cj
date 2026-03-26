main() {
    // Define two Option type variables
    let a: ?Int64 = Some(42)
    let b: ?Int64 = None

    // Basic if-let unpacking
    if (let Some(value) <- a) {
        println("Value of a: ${value}")
    } else {
        println("a is empty")
    }

    if (let Some(value) <- b) {
        println("Value of b: ${value}")
    } else {
        println("b is empty")
    }

    // if-let with additional condition check
    let x: ?Int64 = Some(10)
    if (let Some(v) <- x && v > 5) {
        println("Value of x: ${v} is greater than 5")
    } else {
        println("x is empty or value not greater than 5")
    }

    // Multiple let pattern combinations
    let p: ?Int64 = Some(3)
    let q: ?Int64 = Some(5)
    if (let Some(m) <- p && let Some(n) <- q) {
        println("p + q = ${m + n}")
    }

    // Using || to connect (not binding variables)
    let r: ?Int64 = None
    if (let Some(_) <- a || let Some(_) <- r) {
        println("At least one of a or r is non-empty")
    }
}
func swap(a: Int64, b: Int64): (Int64, Int64) {
    (b, a)
}

main() {
    let point = (3, 4)
    println("x = ${point[0]}, y = ${point[1]}")

    let (x, y) = point
    println("解构后: x = ${x}, y = ${y}")

    let pair = swap(1, 2)
    println("交换后: (${pair[0]}, ${pair[1]})")
}

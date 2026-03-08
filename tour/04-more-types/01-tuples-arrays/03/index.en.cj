main() {
    let numbers = [10, 20, 30, 40]
    println("size = ${numbers.size}")

    numbers[1] = 25
    println("numbers[1] = ${numbers[1]}")

    let middle = numbers[1..3]
    println("middle = ${middle}")

    for (i in 0..numbers.size) {
        println("numbers[${i}] = ${numbers[i]}")
    }
}

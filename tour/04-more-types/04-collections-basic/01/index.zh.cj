import std.collection.ArrayList

main(): Int64 {
    let numbers = ArrayList<Int64>()
    numbers.add(10)
    numbers.add(20)
    numbers.add(30)
    numbers.add(25, at: 2)

    println("size = ${numbers.size}")
    println("numbers[2] = ${numbers[2]}")

    numbers[0] = 11
    numbers.remove(at: 1)

    for (number in numbers) {
        println(number)
    }
    return 0
}

import std.collection.ArrayList

main(): Int64 {
    let numbers = ArrayList<Int64>([1, 2, 3, 4, 5])

    let squares = ArrayList<Int64>()
    for (number in numbers) {
        squares.add(number * number)
    }

    let evens = ArrayList<Int64>()
    for (number in numbers) {
        if (number % 2 == 0) {
            evens.add(number)
        }
    }

    var sum = 0
    for (number in numbers) {
        sum += number
    }

    println("squares:")
    for (value in squares) {
        println(value)
    }

    println("evens:")
    for (value in evens) {
        println(value)
    }

    println("sum = ${sum}")
    return 0
}

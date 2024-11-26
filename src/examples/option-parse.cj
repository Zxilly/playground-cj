func parseInt(text: String): Option<Int64> {
    if (text.isEmpty() || text == "-") {
        return None
    }
    var sign = if (text[0] == 45u8) { 1 } else { 0 }
    var sum = 0
    for (i in sign..text.size) {
        if (text[i] > 57u8 || text[i] < 48u8) {
            return None
        }
        let digit = Int64(text[i] - 48u8)
        sum = 10 * sum + digit
    }
    return if (sign == 1) { -sum } else { sum }
}

main() {
    let number = parseInt("-123456")
    println(number.getOrThrow())
    let result = parseInt("123-456")
    if (result.isNone()) {
        println("parse failed")
    }
}

package playground

main() {
    let metaArray = [r'A', r'B', r'C', r'D', r'E',
        r'F', r'G', r'H', r'I', r'J']
    let noumenonArray = [r'K', r'L', r'M', r'N', r'O', r'P',
        r'Q', r'R', r'S', r'T', r'U', r'V']
    let year = 2024
    // Index of the heavenly stem corresponding to the year
    let metaOfYear = ((year % 10) + 10 - 4) % 10
    // Index of the heavenly stem corresponding to the first month of this year
    var index = (2 * metaOfYear + 3) % 10 - 1
    println("Lunar 2024 year month stems and branches:")
    for (noumenon in noumenonArray) {
        print("${metaArray[index]}${noumenon} ")
        index = (index + 1) % 10
    }
}
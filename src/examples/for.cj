main() {
    let metaArray = [r'甲', r'乙', r'丙', r'丁', r'戊',
        r'己', r'庚', r'辛', r'壬', r'癸']
    let noumenonArray = [r'寅', r'卯', r'辰', r'巳', r'午', r'未',
        r'申', r'酉', r'戌', r'亥', r'子', r'丑']
    let year = 2024
    // 年份对应的天干索引
    let metaOfYear = ((year % 10) + 10 - 4) % 10
    // 此年首月对应的天干索引
    var index = (2 * metaOfYear + 3) % 10 - 1
    println("农历 2024 年各月干支：")
    for (noumenon in noumenonArray) {
        print("${metaArray[index]}${noumenon} ")
        index = (index + 1) % 10
    }
}

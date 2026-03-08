main() {
    let score = 85

    // 基本 if-else
    if (score >= 60) {
        println("及格")
    } else {
        println("不及格")
    }

    // 多级条件判断
    if (score >= 90) {
        println("等级: A")
    } else if (score >= 80) {
        println("等级: B")
    } else if (score >= 70) {
        println("等级: C")
    } else if (score >= 60) {
        println("等级: D")
    } else {
        println("等级: F")
    }
}

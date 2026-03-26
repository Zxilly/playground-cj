main() {
    let score = 85

    // 基本的 if-else 判断
    if (score >= 60) {
        println("成绩: ${score} - 及格")
    } else {
        println("成绩: ${score} - 不及格")
    }

    // 多级条件判断
    if (score >= 90) {
        println("等级: A (优秀)")
    } else if (score >= 80) {
        println("等级: B (良好)")
    } else if (score >= 70) {
        println("等级: C (中等)")
    } else if (score >= 60) {
        println("等级: D (及格)")
    } else {
        println("等级: F (不及格)")
    }

    // else 分支可以省略
    if (score == 100) {
        println("满分!")
    }
}
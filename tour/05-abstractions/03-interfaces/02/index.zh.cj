// 定义 Runner 接口
interface Runner {
    func run(): String
}

// Dog 实现接口
class Dog <: Runner {
    public func run(): String {
        "小狗欢快地奔跑"
    }
}

// Athlete 实现接口
class Athlete <: Runner {
    public func run(): String {
        "运动员快速奔跑"
    }
}

// 接受任何 Runner 接口类型的函数
func showRun(item: Runner) {
    let result = item.run()
    println("动作: ${result}")
}

// 检查谁跑得快
func race(r1: Runner, r2: Runner) {
    println("比赛开始!")
    println("选手1: ${r1.run()}")
    println("选手2: ${r2.run()}")
}

main() {
    let dog = Dog()
    let athlete = Athlete()

    println("=== 演示多态 ===")
    showRun(dog)      // 传入 Dog
    showRun(athlete)  // 传入 Athlete

    println("\n=== 比赛 ===")
    race(dog, athlete)

    // 接口类型的数组
    let runners: Array<Runner> = [dog, athlete]
    println("\n=== 集体训练 ===")
    for (r in runners) {
        println("- ${r.run()}")
    }
}
class Temperature {
    // 实际存储的字段
    var celsius: Float64

    init(celsius: Float64) {
        this.celsius = celsius
    }

    // 只读计算属性：华氏温度
    public prop fahrenheit: Float64 {
        get() {
            celsius * 9.0 / 5.0 + 32.0
        }
    }

    // 只读计算属性：温度描述
    public prop description: String {
        get() {
            "${celsius}°C / ${fahrenheit}°F"
        }
    }

    // 可变属性：温度等级
    public mut prop level: String {
        get() {
            if (celsius < 0.0) {
                "冰冷"
            } else if (celsius < 20.0) {
                "凉爽"
            } else if (celsius < 30.0) {
                "温暖"
            } else {
                "炎热"
            }
        }
        set(v) {
            // 根据 level 反向设置摄氏度（简化版）
            if (v == "冰冷") {
                celsius = -10.0
            } else if (v == "凉爽") {
                celsius = 15.0
            } else if (v == "温暖") {
                celsius = 25.0
            } else if (v == "炎热") {
                celsius = 35.0
            }
        }
    }
}

main() {
    let temp = Temperature(25.0)
    println("初始温度: ${temp.description}")
    println("温度等级: ${temp.level}")

    // 修改存储字段，计算属性自动更新
    temp.celsius = 0.0
    println("水的冰点: ${temp.description}")
    println("温度等级: ${temp.level}")

    temp.celsius = 100.0
    println("水的沸点: ${temp.description}")
    println("温度等级: ${temp.level}")

    // 通过属性修改
    temp.level = "凉爽"
    println("设置凉爽: ${temp.description}")
}
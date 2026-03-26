main() {
    println("倒计时开始...")

    var count = 5
    while (count > 0) {
        println("${count}...")
        
        // 暂停 200 毫秒
        sleep(200 * Duration.millisecond)
        
        count -= 1
    }

    // 最后打印 "go" 之前再暂停一下
    sleep(300 * Duration.millisecond)
    println("go!")
    
    println("倒计时结束")
}
main() {
    let scores = [90, 85, 78, 92, 88, 76]
    println("全部成绩: ${scores}")
    
    // 基本切片: start..end (不包含 end)
    let top3 = scores[0..3]
    println("前三名: ${top3}")
    
    // 省略起始位置，从 0 开始
    let first4 = scores[..4]
    println("前四个: ${first4}")
    
    // 省略结束位置，到数组末尾
    let last3 = scores[3..]
    println("后三个: ${last3}")
    
    // 切片返回新数组，修改不影响原数组
    let slice = scores[1..3]
    println("切片: ${slice}")
    
    // 使用 slice 是新数组（需要用 var 才能修改元素）
    // 注意：这里 slice 是 let，所以不能修改
    
    // 按索引遍历
    println("按索引遍历:")
    for (i in 0..scores.size) {
        println("  scores[${i}] = ${scores[i]}")
    }
    
    // 同时获取索引和值
    println("索引和值:")
    for ((index, value) in scores.enumerate()) {
        println("  [${index}] = ${value}")
    }
}
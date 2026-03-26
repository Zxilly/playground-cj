// 声明 C 内存管理函数
foreign func malloc(size: UIntNative): CPointer<Unit>
foreign func free(ptr: CPointer<Unit>): Unit

// 安全封装：分配一个 Int64，写入值，读取回来
// 如果分配失败则返回 None
func safeAlloc(value: Int64): Option<Int64> {
    let raw = unsafe { malloc(8) }  // 分配 8 字节（Int64 大小）
    
    // 检查分配是否成功
    if (raw.isNull()) {
        return None
    }
    
    // 类型转换为具体指针
    var p = unsafe { CPointer<Int64>(raw) }
    
    // 写入数据
    unsafe { p.write(value) }
    
    // 读取数据
    let result = unsafe { p.read() }
    
    // 释放内存
    unsafe { free(raw) }
    
    return result
}

// 另一个示例：安全地操作数组
func safeArrayOp(): Option<Int64> {
    let count: UIntNative = 3
    let raw = unsafe { malloc(count * 8) }  // 3 个 Int64
    
    if (raw.isNull()) {
        return None
    }
    
    var p = unsafe { CPointer<Int64>(raw) }
    
    // 写入多个值
    unsafe {
        p.write(100)
        (p + 1).write(200)
        (p + 2).write(300)
    }
    
    // 读取中间的值
    let middle = unsafe { (p + 1).read() }
    
    // 释放内存
    unsafe { free(raw) }
    
    return middle
}

main() {
    // unsafe 细节被封装在 safeAlloc 内部
    match (safeAlloc(42)) {
        case Some(v) => println("安全分配成功: Got ${v}")
        case None => println("分配失败: 内存不足")
    }
    
    // 测试数组操作
    match (safeArrayOp()) {
        case Some(v) => println("数组中间元素: ${v}")
        case None => println("数组操作失败")
    }
    
    // 演示空指针检查
    var nullPtr = CPointer<Int64>()
    println("空指针检查: ${nullPtr.isNull()}")
    
    // 分配失败的情况（分配 0 字节在某些实现中返回 null）
    let zeroAlloc = unsafe { malloc(0) }
    println("零字节分配是否为空: ${zeroAlloc.isNull()}")
    unsafe { free(zeroAlloc) }
}
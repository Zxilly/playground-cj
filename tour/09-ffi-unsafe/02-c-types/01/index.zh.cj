// 声明 C 标准库函数。
foreign func malloc(size: UIntNative): CPointer<Unit>
foreign func free(ptr: CPointer<Unit>): Unit

// 定义一个与 C 互操作的结构体。
@C
struct Point3D {
    var x: Int64
    var y: Int64
    var z: Int64

    init(x: Int64, y: Int64, z: Int64) {
        this.x = x
        this.y = y
        this.z = z
    }
}

main() {
    // 创建一个空指针。
    let p1 = CPointer<Point3D>()
    println("p1 是否为空: ${p1.isNull()}")

    // 按 Point3D 的实际大小分配内存。
    let raw = unsafe { malloc(UIntNative(sizeOf<Point3D>())) }
    if (raw.isNull()) {
        throw Exception("Allocation failed")
    }
    
    // 将 CPointer<Unit> 转换为 CPointer<Point3D>。
    let p2 = unsafe { CPointer<Point3D>(raw) }
    println("p2 是否为空: ${p2.isNull()}")

    // 通过指针写入数据。
    unsafe { p2.write(Point3D(10, 20, 30)) }

    // 通过指针读取数据。
    let point = unsafe { p2.read() }
    println("读取到的点: (${point.x}, ${point.y}, ${point.z})")

    // 指针算术：偏移到下一个 Point3D 的位置。
    let p3: CPointer<Point3D> = unsafe { p2 + 1 }
    println("偏移后的指针与原指针差: ${p3.toUIntNative() - p2.toUIntNative()} 字节")

    // 释放内存。
    unsafe { free(raw) }
    println("内存已释放")
}
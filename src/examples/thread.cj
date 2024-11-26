import std.collection.*
import std.random.*
import std.math.*

const M = 200000
const N = 16
func task(): Int64 {
    var n: Int64 = 0
    let random = Random()
    for (_ in 0..M) {
        let x = random.nextFloat64()
        let y = random.nextFloat64()
        if ((x - 0.5) ** 2 + (y - 0.5) ** 2 < 0.25) {
            n++
        }
    }
    return n
}

main() {
    let futures = ArrayList<Future<Int64>>()
    for (_ in 0..N) {
        let future = spawn { task() }
        futures.append(future)
    }
    var n = 0
    for (future in futures) {
        n += future.get()
    }
    let pi = Float64(n) / Float64(M * N) * 4.0
    println("π ≈ ${pi}")
    println("deviation: ${abs(Float64.PI - pi)}")
}

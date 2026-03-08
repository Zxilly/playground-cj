import std.math.*

func sqrt(x: Float64): Option<Float64> {
    // TODO: return Some(sqrt(x)) if x >= 0, else None
    None
}

func safeSqrt(x: Float64): Float64 {
    // TODO: use ?? to return 0.0 for None
    0.0
}

main(): Unit {
    println(sqrt(4.0))
    println(sqrt(-1.0))
    println(safeSqrt(9.0))
    println(safeSqrt(-1.0))
}

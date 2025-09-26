package playground

/**
 * Example scenario: Express Rubik's cube permutation group in Cangjie language and perform simulation verification
 *                  This example demonstrates Cangjie's expressiveness in algebra/symbolic computation, as well as the language's ease of use and flexibility
 * Features involved: enum/constructor/recursive definition/pattern matching, operator overloading, interface, type alias, recursive call,
 *                   class, tuple, Array, HashMap, for-in/Range, if-let, lambda
 */
import std.collection.*

enum Rotation <: ToString & Hashable & Equatable<Rotation> {
    // In Rubik's cube research, Front/Back/Left/Right/Up/Down are usually used to represent six faces and corresponding atomic operations, i.e., clockwise rotation of 90 degrees facing this face
    F
    | B
    | L
    | R
    | U
    | D
    | X(Rotation, Rotation) // Cangjie supports enum constructors and recursive definitions, here X is used to organize composite rotation operations
    | I(Rotation) // I(r) is used to represent the inverse transformation of r, i.e., counterclockwise rotation of 90 degrees facing r face

    // Member functions can also be defined in enum, here we overload the * operator to implement combination of rotation operations, thus generating a permutation group
    public operator func *(that: Rotation): Rotation {
        match (this) {
            case X(x1, x2) => X(x1, X(x2, that)) // Decompose and recombine in this order, so that transformations are executed from left to right during recursion
            case _ => X(this, that)
        }
    }

    // Overload ** operator to implement exponentiation, to express and verify high-order permutation operations, such as (F*F*L*L*B*R)**90 will return the cube to initial state
    public operator func **(exp: UInt32): Rotation {
        var result = this
        for (_ in 0..(exp - 1)) {
            result = result * this
        }
        return result
    }

    // Implement ToString interface for printing and debugging this algebraic system
    private func text(inv: Bool): String {
        let exp = if (inv) {
            "⁻¹"
        } else {
            ""
        }
        match (this) {
            case F => "F${exp}"
            case B => "B${exp}"
            case L => "L${exp}"
            case R => "R${exp}"
            case U => "U${exp}"
            case D => "D${exp}"
            case I(r) => r.text(!inv)
            case X(x1, x2) =>
                if (inv) { // Inverse transformation needs reverse order
                    x2.text(inv) + x1.text(inv)
                } else {
                    x1.text(inv) + x2.text(inv)
                }
        }
    }

    public func toString(): String {
        text(false)
    }

    // Implement Hashable and Equatable interfaces below so that Rotation can be used as HashMap Key
    public func hashCode(): Int64 {
        this.toString().hashCode()
    }

    public operator func ==(that: Rotation): Bool {
        this.toString() == that.toString()
    }

    public operator func !=(that: Rotation): Bool {
        this.toString() != that.toString()
    }
}

type Face = Rotation

type Vector = Array<(Face, Int64)>

type Matrix = Array<Vector>

enum Index {
    Row(Int64) | Col(Int64) | Inv(Index)
    // Used to mark vector inversion
    public operator func -(): Index {
        match (this) {
            case Inv(v) => v
            case _ => Inv(this)
        }
    }
    // Remove Inv symbol
    public func value(): Index {
        match (this) {
            case Inv(v) => v
            case _ => this
        }
    }
}

extend Matrix {
    // Create initial matrix for specified cube face
    public static func create(face: Face) {
        Matrix(
            3,
            {
                i => Vector(3, {j => (face, 3 * i + j + 1)})
            }
        )
    }

    // Get row or column of matrix
    public operator func [](index: Index): Vector {
        match (index) {
            case Row(r) => this[r].clone()
            case Col(c) => Vector(this.size, {i => this[i][c]})
            case Inv(i) => this[i] // For application scenarios, ignore symbols and don't invert when getting values
        }
    }

    // Assign values to matrix rows or columns
    public func set(index: Index, value: Vector): Unit {
        match (index) {
            case Row(r) => this[r] = value
            case Col(c) => for (i in 0..value.size) {
                this[i][c] = value[i]
            }
            case Inv(i) => // Invert according to index symbol when assigning
                value.reverse()
                this.set(i, value)
        }
    }

    // Print one row of matrix
    public func print(row: Int64) {
        for ((face, id) in this[row]) {
            print("${face}${id} ")
        }
    }

    // Print entire matrix
    public func print() {
        for (row in 0..this.size) {
            print("         ")
            print(row)
            println()
        }
    }
}

// Directly using the above enum to represent row and column indices is not elegant enough, we extend two properties for integers so that index values can directly mark rows and columns
extend Int64 {
    public prop r: Index {
        get() {
            Index.Row(this)
        }
    }
    public prop c: Index {
        get() {
            Index.Col(this)
        }
    }
}

// Permutation can represent a permutation sequence
// Such as [(L, 2.c), (U, -0.r)] represents the cycle between L face third column and U face first row, and the former needs to be inverted when swapped to the latter
type Permutation = Array<(Face, Index)>

extend Permutation {
    // Get the inverse transformation of current permutation
    public func inverse() {
        let perm = this.clone()
        for (i in 0..perm.size) {
            let j = (i + 1) % perm.size
            let (face, index) = this[i] // Destructure tuple
            if (let Inv(_) <- this[j][1]) { // if-let pattern matching
                perm[i] = (face, -(index.value()))
            } else {
                perm[i] = (face, index.value())
            }
        }
        perm.reverse()
        return perm
    }
}

class Cube {
    public let data = HashMap<Face, Matrix>()
    private var history = ArrayList<Rotation>()
    private static let permutation = HashMap<Face, Permutation>()

    public init() {
        reset()
    }

    static init() {
        // Permutation relationship of adjacent four faces when each face rotates clockwise 90 degrees
        permutation[F] = [(L, 2.c), (U, -2.r), (R, 0.c), (D, -0.r)]
        permutation[B] = [(L, -0.c), (D, 2.r), (R, -2.c), (U, 0.r)]
        permutation[L] = [(U, 0.c), (F, 0.c), (D, 0.c), (B, 0.c)]
        permutation[R] = [(B, 2.c), (D, 2.c), (F, 2.c), (U, 2.c)]
        permutation[U] = [(L, 0.r), (B, -2.r), (R, -0.r), (F, 0.r)]
        permutation[D] = [(R, 2.r), (B, -0.r), (L, -2.r), (F, 2.r)]
    }

    public func reset() {
        history = ArrayList<Rotation>()
        for (face in [F, B, L, R, U, D]) {
            data[face] = Matrix.create(face)
        }
    }

    // Rotate matrix on specified face by 90 degrees, inverse = true means counterclockwise direction
    // This operation does not affect other faces, must be combined with adjacent edge permutation operation to complete actual cube rotation
    private func rotate(face: Face, inverse: Bool) {
        const N = 3
        let matrix = Matrix.create(face)
        let map = if (inverse) {
            {i: Int64, j: Int64 => (N - 1 - j, i)}
        } else {
            {i: Int64, j: Int64 => (j, N - 1 - i)}
        }
        for (i in 0..N) {
            for (j in 0..N) {
                let (u, v) = map(i, j)
                matrix[u][v] = data[face][i][j]
            }
        }
        data[face] = matrix
    }

    // Implement permutation operations between rows/columns of various faces, input is a permutation sequence
    private func permute(perm: Permutation, inverse: Bool) {
        let p = if (inverse) {
            perm.inverse()
        } else {
            perm.clone()
        }
        p.reverse()
        var (lastFace, lastIndex) = p[0]
        let vector = data[lastFace][lastIndex]
        for (i in 1..p.size) {
            let (face, index) = p[i]
            data[lastFace].set(lastIndex, data[face][index])
            (lastFace, lastIndex) = (face, index)
        }
        data[lastFace].set(lastIndex, vector)
    }

    // Execute operation sequence defined in rotation on the cube in order
    private func transform(rotation: Rotation, inverse: Bool): Unit {
        match (rotation) {
            case I(r) => transform(r, !inverse)
            case X(r1, r2) => // Recursively decompose composite operations
                if (inverse) { // Inverse transformation needs reverse order
                    transform(r2, inverse)
                    transform(r1, inverse)
                } else {
                    transform(r1, inverse)
                    transform(r2, inverse)
                }
            case _ => // For each atomic operation, corresponding face first rotates 90 degrees, then execute permutation operation on adjacent four faces
                rotate(rotation, inverse)
                permute(permutation[rotation], inverse)
        }
    }

    public func transform(rotation: Rotation) {
        transform(rotation, false)
        history.add(rotation)
        print()
    }

    public func print() {
        var prompt = ">> "
        for (rotation in history) {
            prompt += rotation.toString()
        }
        println(prompt)
        data[U].print()
        for (i in 0..3) {
            for (face in [L, F, R]) {
                data[face].print(i)
            }
            println()
        }
        data[D].print()
        data[B].print()
        println()
    }
}

main() {
    let cube = Cube()
    cube.print()
    // 1. Basic operations
    for (r in [F, B, L, R, U, D]) {
        cube.transform(r) // Atomic operation
    }
    Cube().transform(F * R * I(F * R)) // Composite operation

    // 2. Order of permutation
    // FFRR is combination of 2,3 order permutations, its least common multiple is 6, repeating 6 times both types of permutations will restore
    Cube().transform((F * F * R * R) ** 6)
    // FULLR is combination of 3,4,6,9,18 order permutations, similarly its order is 36
    Cube().transform((F * U * L * L * R) ** 36)
    Cube().transform((F * F * L * L * B * R) ** 90)

    // 3. Similarity transformation UGU⁻¹
    // Known R⁻¹DRFDF⁻¹ can flip FUR corner block
    let G = I(R) * D * R * F * D * I(F)
    Cube().transform(G)
    // To flip BUR corner block, first execute U to move BUR to FUR position, then execute G to flip FUR, finally execute U⁻¹ to restore BUR position
    let H = U * G * I(U)
    Cube().transform(H)

    // 4. Commutator transformation MU⁻¹M⁻¹U
    // Known RL⁻¹FFLR⁻¹D⁻¹RL⁻¹FLR⁻¹ can keep other blocks on top face unchanged, only flip UF edge block, but bottom two layers will be scrambled
    let M = R * I(L) * F * F * L * I(R) * I(D) * R * I(L) * F * L * I(R)
    Cube().transform(M)
    // To flip both UF and UL simultaneously, first execute M to flip UF, then execute U⁻¹ to move UL to UF position
    // Then execute M⁻¹ to flip UL and restore bottom two layers, finally execute U to restore UF and UL positions, so the entire cube only has UF and UL flipped
    let N = M * I(U) * I(M) * U
    Cube().transform(N)
    // Based on this, if we want to flip UL and UR simultaneously, we can execute NUN⁻¹U⁻¹ following commutator thinking
    let P = N * U * I(N) * I(U)
    Cube().transform(P)
}
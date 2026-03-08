class Grid {
    let rows: Int64
    let cols: Int64
    let data: Array<Int64>

    public init(rows: Int64, cols: Int64) {
        this.rows = rows
        this.cols = cols
        this.data = Array<Int64>(rows * cols, {_ => 0})
    }

    // Read access: grid[row, col]
    operator func [](row: Int64, col: Int64): Int64 {
        return this.data[row * this.cols + col]
    }

    // Write access: grid[row, col] = value
    operator func [](row: Int64, col: Int64, value!: Int64): Unit {
        this.data[row * this.cols + col] = value
    }

    func display(): Unit {
        var r = 0
        while (r < this.rows) {
            var line = ""
            var c = 0
            while (c < this.cols) {
                if (c > 0) {
                    line = line + "\t"
                }
                line = line + "${this[r, c]}"
                c += 1
            }
            println(line)
            r += 1
        }
    }
}

main() {
    let grid = Grid(3, 3)

    // Set values using subscript
    grid[0, 0] = 1
    grid[0, 1] = 2
    grid[0, 2] = 3
    grid[1, 0] = 4
    grid[1, 1] = 5
    grid[1, 2] = 6
    grid[2, 0] = 7
    grid[2, 1] = 8
    grid[2, 2] = 9

    println("Grid contents:")
    grid.display()

    // Read using subscript
    println("Center element: ${grid[1, 1]}")
}

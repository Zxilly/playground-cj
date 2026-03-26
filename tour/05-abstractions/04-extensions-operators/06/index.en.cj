class Grid {
    private let rows: Int64
    private let cols: Int64
    private var data: Array<Int64>

    public init(rows: Int64, cols: Int64) {
        this.rows = rows
        this.cols = cols
        this.data = Array<Int64>(rows * cols, {_ => 0})
    }

    // Getter form: grid[row, col]
    public operator func [](row: Int64, col: Int64): Int64 {
        return this.data[row * this.cols + col]
    }

    // Setter form: grid[row, col] = value
    public operator func [](row: Int64, col: Int64, value!: Int64): Unit {
        this.data[row * this.cols + col] = value
    }

    // Display grid contents
    public func display(): Unit {
        println("Grid contents (${this.rows} x ${this.cols}):")
        var r: Int64 = 0
        while (r < this.rows) {
            var line = ""
            var c: Int64 = 0
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

    // Get number of rows
    public prop numRows: Int64 {
        get() { this.rows }
    }

    // Get number of columns
    public prop numCols: Int64 {
        get() { this.cols }
    }
}

main() {
    let grid = Grid(3, 3)

    // Use subscript operator to assign values
    grid[0, 0] = 1
    grid[0, 1] = 2
    grid[0, 2] = 3
    grid[1, 0] = 4
    grid[1, 1] = 5
    grid[1, 2] = 6
    grid[2, 0] = 7
    grid[2, 1] = 8
    grid[2, 2] = 9

    // Display entire grid
    grid.display()
    println()

    // Use subscript operator to get values
    println("Center element grid[1,1] = ${grid[1, 1]}")
    println("Top-left corner grid[0,0] = ${grid[0, 0]}")
    println("Bottom-right corner grid[2,2] = ${grid[2, 2]}")
    println()

    // Modify an element
    println("Changing grid[1,1] to 99")
    grid[1, 1] = 99
    println("After modification grid[1,1] = ${grid[1, 1]}")
}
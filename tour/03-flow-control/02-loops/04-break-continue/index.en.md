# break & continue

`break` and `continue` control the flow of loop execution.

**break**: Immediately terminates the entire loop and exits the loop body.

**continue**: Skips the rest of the current iteration and moves to the next one.

Both expressions have type `Nothing` because they alter the normal execution flow. They can only be used inside loop bodies (`while`, `do-while`, `for-in`).

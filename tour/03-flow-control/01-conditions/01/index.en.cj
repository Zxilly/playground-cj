main() {
    let score = 85

    // Basic if-else judgment
    if (score >= 60) {
        println("Score: ${score} - Pass")
    } else {
        println("Score: ${score} - Fail")
    }

    // Multi-level conditional judgment
    if (score >= 90) {
        println("Grade: A (Excellent)")
    } else if (score >= 80) {
        println("Grade: B (Good)")
    } else if (score >= 70) {
        println("Grade: C (Average)")
    } else if (score >= 60) {
        println("Grade: D (Pass)")
    } else {
        println("Grade: F (Fail)")
    }

    // else branch can be omitted
    if (score == 100) {
        println("Perfect score!")
    }
}
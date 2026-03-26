// Congratulations on completing the toolchain learning!
//
// You have learned:
// - Use cjc to compile single files and packages
// - Use cjpm init to initialize projects
// - Use cjpm build to compile projects
// - Use cjpm run to compile and run
// - Use cjpm test to run tests
// - Use workspaces to manage multi-module projects

main(): Unit {
    println("Congratulations! You have mastered the basics of Cangjie toolchain")
    
    let skills = [
        "cjc compiler",
        "cjpm package manager",
        "project initialization",
        "build and run",
        "workspace management"
    ]
    
    println("\nSkills mastered:")
    for (skill in skills) {
        println("  ✓ ${skill}")
    }
    
    println("\nContinue exploring the Cangjie programming language!")
}
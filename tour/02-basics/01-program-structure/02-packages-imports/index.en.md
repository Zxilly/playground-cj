# Packages & Imports

Cangjie uses packages to organize code. The standard library provides a rich set of packages that can be imported using the `import` statement.

The basic import syntax is `import packagePath.name`. Use `*` to import all public members from a package, e.g. `import std.collection.*`.

You can also import specific items: `import std.math.min`, or import multiple items at once using braces: `import std.math.{min, max}`.

In the Playground environment, commonly used standard library features are available directly, but in some cases you may still need explicit imports.

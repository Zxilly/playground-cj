# Access Rules in Extensions

When using extensions, there are important access rules to understand:

- Extensions **can** add new methods
- Extensions **cannot** add stored properties (member variables)
- Extensions can only access **public** members of the type
- Extensions can access the public interface of `this` and any parameters

These restrictions ensure that extensions do not break the encapsulation of the original type. Since extensions are defined outside the type, they can only interact with it through its public interface.

The code on the right shows how extensions interact with types through public methods. The extension adds area calculation and description functionality to `Rectangle`, using only its public properties.
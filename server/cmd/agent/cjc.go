package main

type Position struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

type Import struct {
	File  string   `json:"file"`
	Begin Position `json:"begin"`
	End   Position `json:"end"`
}

type Dependency struct {
	Package string   `json:"package"`
	IsStd   bool     `json:"isStd"`
	Imports []Import `json:"imports"`
}

type CjcDepRoot struct {
	Package      string       `json:"package"`
	IsMacro      bool         `json:"isMacro"`
	AccessLevel  string       `json:"accessLevel"`
	Dependencies []Dependency `json:"dependencies"`
}

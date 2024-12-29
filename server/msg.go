package server

type ForwardMessage struct {
	Data []byte `json:"data"`
}

type FormatMessage struct {
	Formatted       string `json:"formatted"`
	FormatterOutput string `json:"formatter_output"`
	FormatterCode   int    `json:"formatter_code"`
}

type RunMessage struct {
	CompilerOutput string `json:"compiler_output"`
	CompilerCode   int    `json:"compiler_code"`
	BinOutput      string `json:"bin_output"`
	BinCode        int    `json:"bin_code"`
}

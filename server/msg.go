package server

import "encoding/json"

//type Message struct {
//	Typ   string `json:"type"`
//	Data1 []byte `json:"data"`
//	Data2 []byte `json:"data2"`
//	Code  int    `json:"code"`
//}

type Message struct {
	Typ  string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type ForwardMessage struct {
	Data []byte `json:"data"`
}

type FormatMessage struct {
	Formatted       []byte `json:"formatted"`
	FormatterOutput []byte `json:"formatter_output"`
	FormatterCode   int    `json:"formatter_code"`
}

type RunMessage struct {
	CompilerOutput []byte `json:"compiler_output"`
	CompilerCode   int    `json:"compiler_code"`
	BinOutput      []byte `json:"bin_output"`
	BinCode        int    `json:"bin_code"`
}

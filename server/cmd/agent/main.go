package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/playground-cj/server"
)

func Report(msg server.Message) {
	b, err := json.Marshal(msg)
	if err != nil {
		_, _ = os.Stderr.Write([]byte(err.Error()))
		return
	}
	_, _ = os.Stdout.Write(b)
	_, _ = os.Stdout.Write([]byte("\n"))
}

func runLsp(lsp string) error {
	cmd := exec.Command(lsp)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}

	go func() {
		_, _ = io.Copy(os.Stderr, stderr)
	}()

	go func() {
		for {
			rb := make([]byte, 4096)
			n, err := stdout.Read(rb)
			if err != nil {
				return
			}
			if n > 0 {
				data := server.ForwardMessage{
					Data: rb[:n],
				}
				dataB, _ := json.Marshal(data)
				msg := server.Message{
					Typ:  "forward",
					Data: dataB,
				}
				Report(msg)
			}
		}
	}()

	go func() {
		for {
			scan := bufio.NewScanner(os.Stdin)
			scan.Split(bufio.ScanLines)
			for scan.Scan() {
				v := scan.Bytes()
				msg := server.Message{}
				err := json.Unmarshal(v, &msg)
				if err != nil {
					_, _ = os.Stderr.Write([]byte(err.Error()))
					continue
				}
				switch msg.Typ {
				case "forward":
					data := server.ForwardMessage{}
					_ = json.Unmarshal(msg.Data, &data)
					_, _ = stdin.Write(data.Data)
				case "format":
					format(msg)
				case "run":
					run(msg)
				}
			}
		}
	}()

	err = cmd.Run()
	return err
}

func format(msg server.Message) {
	fMsg := server.ForwardMessage{}
	_ = json.Unmarshal(msg.Data, &fMsg)
	data := fMsg.Data

	tmp, err := os.CreateTemp("", "playground")
	if err != nil {
		panic(err)
	}
	defer func(name string) {
		_ = os.Remove(name)
	}(tmp.Name())
	_ = os.WriteFile(tmp.Name(), data, 0644)
	defer func(tmp *os.File) {
		_ = tmp.Close()
	}(tmp)

	// "cjfmt -f main.cj -o /tmp/fmt.cj 2>&1; echo \"---===---\"; cat /tmp/fmt.cj;"
	cmd := exec.Command("cjfmt", "-f", tmp.Name(), "-o", tmp.Name())

	cjfmtOut := bytes.NewBuffer(nil)
	cmd.Stdout = cjfmtOut
	cmd.Stderr = cjfmtOut
	_ = cmd.Run()

	out, _ := os.ReadFile(tmp.Name())

	ffMsg := server.FormatMessage{
		Formatted:       out,
		FormatterOutput: cjfmtOut.Bytes(),
		FormatterCode:   cmd.ProcessState.ExitCode(),
	}

	b, _ := json.Marshal(ffMsg)
	cMsg := server.Message{
		Typ:  "format",
		Data: b,
	}
	Report(cMsg)
}

func run(msg server.Message) {
	fMsg := server.ForwardMessage{}
	_ = json.Unmarshal(msg.Data, &fMsg)
	data := fMsg.Data

	tmp, err := os.CreateTemp("", "playground")
	if err != nil {
		panic(err)
	}
	defer func(name string) {
		_ = os.Remove(name)
	}(tmp.Name())
	_ = os.WriteFile(tmp.Name(), data, 0644)
	defer func(tmp *os.File) {
		_ = tmp.Close()
	}(tmp)

	// random binary name
	tmpBin := filepath.Join(os.TempDir(), server.RandomString(10))
	defer func(name string) {
		_ = os.Remove(name)
	}(tmpBin)

	dataMsg := server.RunMessage{
		CompilerOutput: nil,
		CompilerCode:   0,
		BinOutput:      nil,
		BinCode:        0,
	}

	compilerOut := bytes.NewBuffer(nil)

	// cjc --static-std --static-libs -o main main.cj && /sandbox/main
	cmd := exec.Command("cjc", "--static-std", "--static-libs", "-o", tmpBin, tmp.Name())
	cmd.Stdout = compilerOut
	cmd.Stderr = compilerOut
	_ = cmd.Run()

	dataMsg.CompilerOutput = compilerOut.Bytes()
	dataMsg.CompilerCode = cmd.ProcessState.ExitCode()

	if cmd.ProcessState.Success() {
		cmd = exec.Command(tmpBin)
		binOut := bytes.NewBuffer(nil)
		cmd.Stdout = binOut
		cmd.Stderr = binOut
		_ = cmd.Run()

		dataMsg.BinOutput = binOut.Bytes()
		dataMsg.BinCode = cmd.ProcessState.ExitCode()
	}

	b, _ := json.Marshal(dataMsg)
	msg = server.Message{
		Typ:  "run",
		Data: b,
	}
	Report(msg)
}

func main() {
	if len(os.Args) < 2 {
		panic("missing required argument: lsp")
	}

	lsp := os.Args[1]

	for {
		err := runLsp(lsp)
		if err != nil {
			var msg = server.Message{
				Typ: "error",
			}
			b, err := json.Marshal(msg)
			if err != nil {
				_, _ = os.Stderr.Write([]byte(err.Error()))
				continue
			}
			_, _ = os.Stdout.Write(b)
		}
	}
}

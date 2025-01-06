package main

import (
	"io"
	"os"
)

type mixedReadWriteCloser struct {
	r io.ReadCloser
	w io.WriteCloser
}

func (m *mixedReadWriteCloser) Read(p []byte) (n int, err error) {
	return m.r.Read(p)
}

func (m *mixedReadWriteCloser) Write(p []byte) (n int, err error) {
	return m.w.Write(p)
}

func (m *mixedReadWriteCloser) Close() error {
	_ = m.r.Close()
	_ = m.w.Close()
	return nil
}

func Report(msg []byte) {
	_, _ = os.Stdout.Write(msg)
	_, _ = os.Stdout.Write([]byte("\n"))
}

func Must(err error) {
	if err != nil {
		panic(err)
	}
}

func Must2[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

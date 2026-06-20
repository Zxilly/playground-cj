package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/Zxilly/playground-cj/server"
)

func handleRun(ctx *gin.Context) {
	payload, err := ctx.GetRawData()
	if err != nil {
		ctx.String(http.StatusBadRequest, err.Error())
		return
	}

	var fwd server.ForwardMessage
	if strings.HasPrefix(ctx.ContentType(), "application/json") {
		var req struct {
			Code  string `json:"code"`
			Stdin string `json:"stdin"`
		}
		if err := json.Unmarshal(payload, &req); err != nil {
			ctx.String(http.StatusBadRequest, err.Error())
			return
		}
		fwd = server.ForwardMessage{Data: []byte(req.Code), Stdin: []byte(req.Stdin)}
	} else {
		fwd = server.ForwardMessage{Data: payload}
	}

	data, err := runCmd(ctx.Request.Context(), "run", fwd)
	if err != nil {
		ctx.String(http.StatusInternalServerError, err.Error())
		return
	}

	var msg server.RunMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		ctx.String(http.StatusInternalServerError, err.Error())
		return
	}

	ctx.JSON(http.StatusOK, json.RawMessage(data))
}

func handleFormat(ctx *gin.Context) {
	payload, err := ctx.GetRawData()
	if err != nil {
		ctx.String(http.StatusBadRequest, err.Error())
		return
	}

	data, err := runCmd(ctx.Request.Context(), "format", server.ForwardMessage{Data: payload})
	if err != nil {
		ctx.String(http.StatusInternalServerError, err.Error())
		return
	}

	var msg server.FormatMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		ctx.String(http.StatusInternalServerError, err.Error())
		return
	}

	ctx.JSON(http.StatusOK, json.RawMessage(data))
}

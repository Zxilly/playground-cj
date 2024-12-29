package main

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/playground-cj/server"
)

func handleRun(ctx *gin.Context) {
	payload, err := ctx.GetRawData()
	if err != nil {
		ctx.String(http.StatusBadRequest, err.Error())
		return
	}

	data, err := runCmd(ctx.Request.Context(), "run", payload)
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

	data, err := runCmd(ctx.Request.Context(), "format", payload)
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

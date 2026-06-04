package rpc

import "encoding/json"

// Request represents a standard JSON-RPC 2.0 request payload
type Request struct {
	JsonRPC string `json:"jsonrpc"` // Must be exactly "2.0"
	Method  string `json:"method"`  // The name of the TS method (e.g., "getValues")
	Params  any    `json:"params"`  // An array or object holding the arguments
	ID      any    `json:"id"`      // A unique identifier (usually an incrementing integer)
}

// Response represents a standard JSON-RPC 2.0 response payload
type Response struct {
	JsonRPC string          `json:"jsonrpc"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *Error          `json:"error,omitempty"`
	ID      any             `json:"id"`
}

// Error represents the error object if a request fails
type Error struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

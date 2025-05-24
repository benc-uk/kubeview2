package main

import (
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

var version = "0.0.1"

func main() {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	config := getConfig()

	log.Printf("🚀 KubeView %s starting on port %d...\n", version, config.Port)

	// This configures the HTTP server, routing and SSE connection
	NewServer(r, config, version)

	//nolint:gosec
	httpServer := &http.Server{
		Addr:    ":" + strconv.Itoa(config.Port),
		Handler: r,
		// Do not set ReadHeaderTimeout it messes with the SSE connection
	}

	if err := httpServer.ListenAndServe(); err != nil {
		log.Fatalf("💥 Server failed to start: %v", err)
	}

	defer (func() {
		if err := httpServer.Close(); err != nil {
			log.Fatalf("💥 Server failed to close: %v", err)
		}
	})()
}

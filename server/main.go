package main

import (
	"log"
	"net/http"
	"os"

	"github.com/benc-uk/kubeview2/server/services"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	ks, err := services.NewKubernetes()
	if err != nil {
		log.Fatalf("💩 Unable to connect to Kubernetes. The app will exit")
	}

	NewServer(r, ks)

	httpServer := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	log.Printf("🚀 Server starting on port %s...\n", port)

	if err := httpServer.ListenAndServe(); err != nil {
		log.Fatalf("💥 Server failed to start: %v", err)
	}

	defer (func() {
		if err := httpServer.Close(); err != nil {
			log.Fatalf("💥 Server failed to close: %v", err)
		}
	})()
}

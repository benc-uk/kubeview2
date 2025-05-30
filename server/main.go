// ==========================================================================================
// The backend server for KubeView, serving the web application via templates
// and connecting to the Kubernetes cluster.
// ==========================================================================================

package main

import (
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

var version = "0.0.0"
var buildInfo = "No build info available"

func main() {
	config := getConfig()

	log.Printf("🚀 KubeView %s starting on port %d...\n", version, config.Port)
	log.Printf("🔧 Configuration %+v", config)

	r := chi.NewRouter()

	// This configures the core server, handling pretty much everything
	api := NewKubeviewAPI(config)
	r.Use(api.SimpleCORSMiddleware)

	api.AddHealthEndpoint(r, "health")
	api.AddStatusEndpoint(r, "api/status")

	api.AddRoutes(r)

	//nolint:gosec
	httpServer := &http.Server{
		Addr:    ":" + strconv.Itoa(config.Port),
		Handler: r,
		// Do NOT set ReadHeaderTimeout it messes with the SSE connection
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

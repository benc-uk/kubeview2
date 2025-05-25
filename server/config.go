package main

import (
	"os"
	"strconv"

	types "github.com/benc-uk/kubeview2/server/types"
)

func getConfig() types.Config {
	port := 8000
	nameSpaceFilter := ""
	singleNamespace := ""

	if portEnv := os.Getenv("PORT"); portEnv != "" {
		if p, err := strconv.Atoi(portEnv); err == nil {
			port = p
		}
	}

	if s := os.Getenv("SINGLE_NAMESPACE"); s != "" {
		singleNamespace = s
	}

	if s := os.Getenv("NAMESPACE_FILTER"); s != "" {
		nameSpaceFilter = s
	}

	return types.Config{
		Port:            port,
		NameSpaceFilter: nameSpaceFilter,
		SingleNamespace: singleNamespace,
	}
}

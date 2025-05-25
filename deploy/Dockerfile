# ====================================
# Build stage
# ====================================
FROM golang:1.24-alpine AS builder
ARG VERSION="0.0.0"

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY server/ ./server/

# Build the Go binary injecting the version
RUN go build -o ./kubeview \
  -ldflags "-X main.version=$VERSION" \
  ./server

# =====================================
# Final minimal image
# =====================================
FROM alpine:3.21

WORKDIR /app

# Copy binary and public assets
COPY --from=builder /build/kubeview .
# Copy public web assets
COPY public/ ./public/

EXPOSE 8000

# Run the binary
CMD ["./kubeview"]
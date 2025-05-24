# ====================================
# Build stage
# ====================================
FROM golang:1.24-alpine AS builder

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY server/ ./server/

# Build the Go binary
RUN go build -o ./kubeview ./server

# =====================================
# Final minimal image
# =====================================
FROM alpine:3.21

WORKDIR /app

# Copy binary and public assets
COPY --from=builder /build/kubeview .
COPY public/ ./public/

EXPOSE 8000

# Run the binary
CMD ["./kubeview"]
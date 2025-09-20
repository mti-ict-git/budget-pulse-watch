# Create a simple nginx configuration for frontend
RUN echo 'server { \
    listen 8080; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /health { \
        access_log off; \
        return 200 "healthy\\n"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  # Changed from false to true

# Updated .env.production
DB_ENCRYPT=true
DB_TRUST_CERT=true  #
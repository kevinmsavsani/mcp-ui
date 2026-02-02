# MCP UI - Production Deployment Guide

## 🏗️ Architecture Overview

```
mcp-ui/
├── backend/                    # Express.js backend server
│   ├── server.ts              # Main server with middleware & endpoints
│   ├── mcpManager.ts          # MCP connection & tool orchestration
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts
│   └── utils/                 # Utility modules
│       ├── logger.ts          # Structured logging & performance monitoring
│       └── healthCheck.ts     # Health checks & diagnostics
├── mcp-servers/               # MCP server implementations
│   └── calculator-server.py   # Local calculator MCP server
├── src/                       # React frontend
│   ├── App.tsx               # Main application component
│   ├── index.css             # Styling with markdown support
│   └── main.tsx              # Entry point
└── .env                      # Environment configuration
```

## 🚀 Production-Ready Features

### Logging & Observability
- **Structured Logging**: JSON-formatted logs with context (component, operation, duration)
- **Log Levels**: DEBUG, INFO, WARN, ERROR with configurable filtering
- **Colored Console Output**: Easy visual debugging during development
- **In-Memory Log Storage**: Last 1000 logs accessible via API
- **Request ID Tracking**: Unique ID for each request for distributed tracing

### Performance Monitoring
- **Operation Timing**: Automatic timing for all major operations
- **Metrics Collection**: Average, min, max, count for each operation
- **Performance API**: `/api/metrics` endpoint for real-time performance data
- **Resource Tracking**: Memory and CPU usage monitoring

### Health & Diagnostics
- **Health Check Endpoint**: `/api/health` with status (healthy/degraded/unhealthy)
- **Detailed Diagnostics**: `/api/diagnostics` with full system information
- **Server Status Monitoring**: Real-time MCP server connection status
- **Graceful Degradation**: System continues with partial server availability

### Error Handling
- **Comprehensive Error Catching**: All endpoints wrapped with try-catch
- **Error Logging**: Full stack traces with context
- **Graceful Shutdown**: Proper cleanup on SIGINT/SIGTERM
- **Unhandled Rejection Handling**: Catches and logs promise rejections
- **User-Friendly Error Messages**: Sanitized errors returned to frontend

### Security & Best Practices
- **Read-Only Mode**: All MCP servers run in read-only mode by default
- **CORS Configuration**: Configurable cross-origin resource sharing
- **Environment Variables**: Sensitive data in .env files
- **Request Validation**: Input validation on all endpoints
- **Type Safety**: Full TypeScript coverage

## 📋 Prerequisites

- **Node.js**: 20+ (LTS recommended)
- **Python**: 3.8+ (for calculator server)
- **Docker**: Latest version (for GitHub & Atlassian servers)
- **npm**: 8+ (comes with Node.js)

## 🔧 Setup Instructions

### 1. Clone & Install

```bash
git clone <repository-url>
cd mcp-ui
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Backend Configuration
BACKEND_PORT=3001
NODE_ENV=production  # or development

# Logging (INFO for production, DEBUG for development)
LOG_LEVEL=INFO
LOG_CONSOLE=true

# Calculator Server (works out of the box)
CALCULATOR_SERVER_PATH=./mcp-servers/calculator-server.py

# GitHub MCP Server
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
GITHUB_HOST=https://github.com

# Atlassian MCP Server
CONFLUENCE_URL=https://your-company.atlassian.net/wiki
CONFLUENCE_USERNAME=your.email@company.com
CONFLUENCE_API_TOKEN=your_confluence_token

JIRA_URL=https://your-company.atlassian.net
JIRA_USERNAME=your.email@company.com
JIRA_API_TOKEN=your_jira_token
```

### 3. Verify Docker

Ensure Docker is running:

```bash
docker --version
docker ps
```

### 4. Start the Application

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm run build
npm run preview
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## 📊 Monitoring & Debugging

### Health Check

```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T12:00:00.000Z",
  "uptime": 123456,
  "version": "1.0.0",
  "services": {
    "backend": {
      "status": "up"
    },
    "mcpServers": {
      "calculator": {
        "connected": true,
        "toolCount": 8,
        "readOnly": true
      }
    }
  },
  "system": {
    "memoryUsage": {...},
    "cpuUsage": {...}
  }
}
```

### Performance Metrics

```bash
curl http://localhost:3001/api/metrics
```

### Detailed Diagnostics

```bash
curl http://localhost:3001/api/diagnostics
```

### Recent Logs

```bash
curl http://localhost:3001/api/logs?count=50
```

## 🔍 Debugging Guide

### Enable Debug Logging

```env
LOG_LEVEL=DEBUG
```

### Check Server Connections

```bash
curl http://localhost:3001/api/servers
```

### List Available Tools

```bash
curl http://localhost:3001/api/tools
```

### Test Calculator

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"add 5 and 3","mode":"auto"}'
```

## 🐛 Common Issues & Solutions

### Issue: Calculator Server Not Connecting

**Solution:**
```bash
# Test Python server directly
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python3 mcp-servers/calculator-server.py

# Check Python version
python3 --version  # Should be 3.8+
```

### Issue: Docker Servers Not Connecting

**Solution:**
```bash
# Check Docker is running
docker ps

# Test GitHub server manually
docker run -i --rm \
  -e GITHUB_PERSONAL_ACCESS_TOKEN=your_token \
  -e GITHUB_HOST=https://github.com \
  ghcr.io/github/github-mcp-server

# Check Docker logs
docker logs <container_id>
```

### Issue: High Memory Usage

**Solution:**
- Check `/api/metrics` for performance bottlenecks
- Review `/api/logs` for memory-intensive operations
- Reduce `MCP_MAX_STEPS` in .env
- Clear log cache: restart the server

### Issue: Slow Response Times

**Solution:**
- Check `/api/metrics` for operation timings
- Enable DEBUG logging to see detailed timing
- Verify network connectivity to Docker containers
- Check system resources (CPU, memory)

## 📈 Performance Optimization

### Production Settings

```env
NODE_ENV=production
LOG_LEVEL=WARN  # Reduce logging overhead
LOG_CONSOLE=false  # Disable console logging
MCP_MAX_STEPS=10  # Limit operation complexity
```

### Monitoring Best Practices

1. **Regular Health Checks**: Set up automated health check monitoring
2. **Metrics Collection**: Collect metrics every 5 minutes
3. **Log Aggregation**: Send logs to centralized logging service
4. **Alert Setup**: Alert on unhealthy status or high error rates

## 🔒 Security Considerations

### Production Checklist

- [ ] Change all default credentials in .env
- [ ] Use environment-specific .env files (never commit .env)
- [ ] Enable HTTPS in production
- [ ] Implement rate limiting on API endpoints
- [ ] Add authentication/authorization for sensitive endpoints
- [ ] Restrict `/api/logs` and `/api/diagnostics` to admin users
- [ ] Regular security audits: `npm audit`
- [ ] Keep dependencies updated
- [ ] Use Docker image scanning for MCP servers
- [ ] Implement request size limits
- [ ] Enable CORS only for trusted origins

### Environment Variables Security

```bash
# Never commit .env files
echo ".env" >> .gitignore

# Use secrets management in production
# Examples: AWS Secrets Manager, HashiCorp Vault, Azure Key Vault
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Calculator operations (add, subtract, multiply, divide, power, sqrt)
- [ ] Auto mode tool selection
- [ ] Manual mode server selection
- [ ] Markdown rendering in responses
- [ ] Server status updates
- [ ] Error handling (invalid inputs, server disconnections)
- [ ] Health check endpoint
- [ ] Metrics endpoint
- [ ] Graceful shutdown

### Example Test Commands

```bash
# Test auto mode
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"calculate 10 * 20","mode":"auto"}'

# Test manual mode
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"add 15 and 25","mode":"manual","server":"calculator"}'

# Test error handling
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"divide 10 by 0","mode":"auto"}'
```

## 📦 Deployment

### Docker Deployment (Recommended)

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001 5173

CMD ["npm", "run", "dev"]
```

Build and run:

```bash
docker build -t mcp-ui .
docker run -p 3001:3001 -p 5173:5173 --env-file .env mcp-ui
```

### Cloud Deployment

#### AWS
- Use ECS or EKS for container orchestration
- Store secrets in AWS Secrets Manager
- Use CloudWatch for logging and monitoring
- Set up Application Load Balancer

#### Azure
- Use Azure Container Instances or AKS
- Store secrets in Azure Key Vault
- Use Azure Monitor for observability
- Set up Application Gateway

#### Google Cloud
- Use Cloud Run or GKE
- Store secrets in Secret Manager
- Use Cloud Logging and Monitoring
- Set up Cloud Load Balancing

## 📞 Support & Maintenance

### Log Rotation

Logs are kept in memory (last 1000 entries). For production:
- Implement file-based logging
- Use log rotation (e.g., winston with daily rotation)
- Send logs to centralized service (ELK, Splunk, Datadog)

### Backup & Recovery

- Backup .env configuration
- Document custom server configurations
- Version control all code changes
- Test disaster recovery procedures

### Monitoring Alerts

Set up alerts for:
- Health status changes to "unhealthy"
- Error rate > 5%
- Response time > 5 seconds
- Memory usage > 80%
- Server disconnections

## 📝 API Documentation

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check with status |
| `/api/diagnostics` | GET | Detailed system diagnostics |
| `/api/metrics` | GET | Performance metrics |
| `/api/logs` | GET | Recent logs (query: count) |
| `/api/servers` | GET | MCP server status |
| `/api/tools` | GET | Available tools from all servers |
| `/api/chat` | POST | Send chat message |

### Request/Response Examples

See [API.md](./API.md) for detailed API documentation.

## 🎯 Roadmap

- [ ] Add authentication & authorization
- [ ] Implement rate limiting
- [ ] Add WebSocket support for real-time updates
- [ ] Implement caching layer
- [ ] Add more MCP servers
- [ ] Create admin dashboard
- [ ] Add automated testing
- [ ] Implement CI/CD pipeline

## 📄 License

MIT

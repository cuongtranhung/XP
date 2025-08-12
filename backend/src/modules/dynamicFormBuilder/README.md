# Dynamic Form Builder Module

A comprehensive form building and management system for the XP project, featuring drag-and-drop form creation, real-time collaboration, advanced analytics, and enterprise-grade security.

## Features

- 🎨 **Drag-and-Drop Form Builder** - Intuitive visual form creation
- 🔄 **Real-time Collaboration** - Multiple users can edit forms simultaneously
- 📊 **Advanced Analytics** - Track form performance and user behavior
- 🔒 **Enterprise Security** - Role-based access, encryption, and audit logging
- 🚀 **High Performance** - Redis caching, optimized queries, and CDN support
- 📱 **Responsive Design** - Works seamlessly across all devices
- 🌐 **Webhook Integration** - Connect forms to external services
- 📤 **Export Capabilities** - Export submissions in multiple formats
- 🔍 **Version History** - Track and restore form changes
- 🌍 **Internationalization** - Multi-language support

## Architecture

```
dynamicFormBuilder/
├── config/              # Configuration management
├── controllers/         # API controllers
├── services/           # Business logic services
├── models/             # Database models
├── routes/             # API routes
├── websocket/          # Real-time functionality
├── migrations/         # Database migrations
├── tests/              # Test suites
├── monitoring/         # Metrics and monitoring
└── types/              # TypeScript definitions
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Docker (optional)

### Installation

1. **Environment Setup**
```bash
# Copy environment template
cp .env.example .env

# Configure database and Redis connections
vim .env
```

2. **Install Dependencies**
```bash
npm install
```

3. **Run Setup Script**
```bash
npm run formbuilder:setup
```

4. **Run Migrations**
```bash
npm run formbuilder:migrate
```

5. **Start the Module**
```bash
npm run dev
```

### Docker Installation

```bash
# Build and start all services
docker-compose -f docker/dynamicFormBuilder/docker-compose.yml up -d

# View logs
docker-compose -f docker/dynamicFormBuilder/docker-compose.yml logs -f
```

## Configuration

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=xp_formbuilder
DB_USER=formbuilder
DB_PASSWORD=secure_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# File Upload
UPLOAD_DIR=./uploads/forms
MAX_FILE_SIZE=10485760

# WebSocket
WS_PORT=5001

# Features
FEATURE_COLLABORATION=true
FEATURE_WEBHOOKS=true
FEATURE_ANALYTICS=true
FEATURE_VERSIONING=true
```

### Module Configuration

```typescript
import { formBuilderConfig } from './config';

// Update configuration
formBuilderConfig.update({
  performance: {
    cache: {
      ttl: 7200, // 2 hours
      maxSize: 2000
    }
  },
  security: {
    rateLimit: {
      maxRequests: 200
    }
  }
});
```

## API Reference

### Forms

- `GET /api/forms` - List user's forms
- `POST /api/forms` - Create new form
- `GET /api/forms/:id` - Get form details
- `PUT /api/forms/:id` - Update form
- `DELETE /api/forms/:id` - Delete form
- `POST /api/forms/:id/publish` - Publish form
- `POST /api/forms/:id/duplicate` - Duplicate form

### Submissions

- `GET /api/forms/:id/submissions` - List form submissions
- `POST /api/forms/:id/submit` - Submit form
- `GET /api/submissions/:id` - Get submission details
- `DELETE /api/submissions/:id` - Delete submission
- `POST /api/forms/:id/export` - Export submissions

### Analytics

- `GET /api/forms/:id/analytics` - Get form analytics
- `GET /api/forms/:id/analytics/fields` - Field-level analytics

### Webhooks

- `GET /api/forms/:id/webhooks` - List webhooks
- `POST /api/forms/:id/webhooks` - Create webhook
- `PUT /api/webhooks/:id` - Update webhook
- `DELETE /api/webhooks/:id` - Delete webhook

## WebSocket Events

### Client → Server

- `join-form` - Join form editing session
- `leave-form` - Leave form editing session
- `form-update` - Update form fields/settings
- `cursor-move` - Share cursor position
- `field-select` - Indicate field selection

### Server → Client

- `user-joined` - User joined editing session
- `user-left` - User left editing session
- `form-updated` - Form was updated
- `collaborators-update` - Active collaborators list
- `cursor-position` - User cursor positions

## Development

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:coverage
```

### Database Migrations

```bash
# Run migrations
npm run formbuilder:migrate

# Rollback last migration
npm run formbuilder:rollback

# Reset database
npm run formbuilder:reset

# Check migration status
npm run formbuilder:status
```

### Monitoring

Access metrics at: `http://localhost:3000/api/formbuilder/metrics`

Grafana dashboards available at: `http://localhost:3001`

## Security

### Best Practices

1. **Authentication**: All form management requires authentication
2. **Authorization**: Users can only access their own forms
3. **Rate Limiting**: Configurable per-endpoint limits
4. **Input Validation**: Strict validation on all inputs
5. **XSS Prevention**: Automatic HTML sanitization
6. **CSRF Protection**: Token-based protection
7. **Encryption**: Sensitive data encrypted at rest

### Security Headers

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

## Performance Optimization

### Caching Strategy

- Form definitions cached for 1 hour
- Submission counts cached for 15 minutes
- Analytics aggregated hourly
- Static assets served via CDN

### Database Optimization

- Indexed queries on frequently accessed columns
- Materialized views for analytics
- Connection pooling with configurable size
- Query result pagination

### File Upload Optimization

- Chunked uploads for large files
- Automatic image compression
- Thumbnail generation
- CDN integration for serving files

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if WebSocket port is open
   - Verify Redis is running
   - Check firewall settings

2. **File Upload Errors**
   - Verify upload directory permissions
   - Check file size limits
   - Ensure allowed MIME types

3. **Migration Failures**
   - Check database permissions
   - Verify schema exists
   - Review migration logs

### Debug Mode

```bash
# Enable debug logging
DEBUG=formbuilder:* npm run dev

# Database query logging
DB_LOG_QUERIES=true npm run dev
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This module is part of the XP project and follows the same license terms.

## Support

For issues and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation at `/docs`
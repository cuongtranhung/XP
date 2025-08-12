# Frontend - Fullstack Authentication System

Modern React application with TypeScript, Tailwind CSS, and comprehensive authentication features.

## Features

- ✅ Modern React 18 with TypeScript
- ✅ Responsive design with Tailwind CSS
- ✅ Authentication flow (login, register, password reset)
- ✅ Protected routes and state management
- ✅ Form validation with React Hook Form
- ✅ Toast notifications
- ✅ Loading states and error handling
- ✅ Mobile-first responsive design
- ✅ Accessibility features
- ✅ Performance optimizations
- ✅ **Dual Form Builder System** (Original + Enhanced versions)
- ✅ Drag-and-drop form creation with DnD Kit
- ✅ Dynamic field types and validation
- ✅ Form preview and submission handling

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6.3.5
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM v6
- **Forms**: React Hook Form + Yup validation
- **HTTP Client**: Axios
- **Notifications**: React Hot Toast
- **Icons**: Lucide React
- **State Management**: React Context + useReducer
- **Drag & Drop**: @dnd-kit/core for Form Builder
- **Animations**: Framer Motion
- **UI Library**: Headless UI components

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── common/         # Common UI components
│   ├── formBuilder/    # 🆕 Dual Form Builder System
│   │   ├── enhanced/   # Enhanced Form Builder (new)
│   │   ├── fields/     # Field type definitions
│   │   ├── utils/      # Form utilities
│   │   └── README.md   # Form Builder documentation
│   └── layout/         # Layout components
├── contexts/           # React contexts
├── pages/              # Page components
├── services/           # API services
├── types/              # TypeScript types
├── utils/              # Utility functions
├── docs/               # 🆕 Project documentation
├── App.tsx             # Main app component
├── main.tsx            # App entry point
└── index.css           # Global styles
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# API Configuration
VITE_API_URL=http://localhost:5000

# Application
VITE_APP_NAME=Fullstack Auth App
VITE_APP_VERSION=2.0.0

# Features
VITE_ENABLE_REGISTRATION=true
VITE_ENABLE_PASSWORD_RESET=true

# Development
VITE_ENABLE_DEBUG=false
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open browser**
   ```
   http://localhost:3000
   ```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Features Overview

### Authentication Flow

**Registration**
- Form validation with real-time feedback
- Password strength indicator
- Terms acceptance
- Email verification flow

**Login**
- Secure authentication
- Remember me option
- Error handling
- Redirect after login

**Password Reset**
- Email-based reset flow
- Token validation
- Secure password update
- Success confirmation

### UI/UX Features

**Responsive Design**
- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly interface
- Accessible navigation

**Form Handling**
- Real-time validation
- Custom error messages
- Loading states
- Accessibility features

**Toast Notifications**
- Success/error feedback
- Auto-dismiss
- Consistent styling
- Screen reader support

### Security Features

**Client-Side Security**
- JWT token management
- Automatic token refresh
- XSS protection
- CSRF protection
- Secure headers

**Input Validation**
- Schema-based validation
- Sanitization
- Real-time feedback
- Security-first approach

## Components

### Common Components

**Button**
```tsx
<Button 
  variant="primary" 
  size="lg" 
  isLoading={loading}
  leftIcon={<Icon />}
>
  Click me
</Button>
```

**Input**
```tsx
<Input
  label="Email"
  type="email"
  leftIcon={<Mail />}
  error={errors.email?.message}
  showPasswordToggle={type === 'password'}
/>
```

**LoadingSpinner**
```tsx
<LoadingSpinner size="lg" color="primary" />
<LoadingOverlay message="Loading..." />
<InlineLoading message="Processing..." />
```

**Alert**
```tsx
<Alert 
  type="success" 
  title="Success!"
  message="Operation completed successfully"
  dismissible
  onDismiss={() => {}}
/>
```

### Layout Components

**AuthLayout**
- Centered authentication forms
- Branding and footer
- Responsive design

**AppLayout**
- Navigation header
- User menu
- Mobile navigation
- Main content area

**ProtectedRoute**
- Authentication checks
- Email verification
- Automatic redirects
- Loading states

## Styling

### Tailwind Configuration

```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: { /* Custom primary colors */ },
      gray: { /* Custom gray scale */ }
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif']
    },
    animation: {
      'fade-in': 'fadeIn 0.5s ease-in-out',
      'slide-up': 'slideUp 0.3s ease-out'
    }
  }
}
```

### Custom CSS Classes

```css
/* Form styles */
.form-input { /* Styled input fields */ }
.form-label { /* Form labels */ }
.form-error { /* Error messages */ }

/* Button styles */
.btn { /* Base button */ }
.btn-primary { /* Primary button */ }
.btn-secondary { /* Secondary button */ }

/* Utilities */
.focus-ring { /* Focus styles */ }
.scrollbar-thin { /* Custom scrollbar */ }
```

## API Integration

### Service Layer
```typescript
// services/api.ts
class ApiService {
  private client: AxiosInstance;
  
  // Authentication methods
  async login(credentials: LoginCredentials): Promise<AuthResponse>
  async register(data: RegisterData): Promise<AuthResponse>
  async getCurrentUser(): Promise<ApiResponse<User>>
  // ... more methods
}
```

### Error Handling
- Automatic token refresh
- Network error handling
- API error messages
- Fallback strategies

## State Management

### Auth Context
```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  // ... more methods
}
```

### Usage
```tsx
const { user, login, logout, isAuthenticated } = useAuth();
```

## Development

### Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run type-check   # TypeScript type checking
```

### Code Quality

**ESLint Configuration**
- TypeScript rules
- React hooks rules
- Accessibility rules
- Performance rules

**TypeScript**
- Strict mode enabled
- Path mapping configured
- Type safety enforced

## Performance

### Build Optimizations
- Code splitting
- Tree shaking
- Asset optimization
- Lazy loading

### Bundle Analysis
```bash
npm run build -- --analyze
```

### Performance Features
- Virtual scrolling for large lists
- Image lazy loading
- Component lazy loading
- Service worker caching

## Testing

### Unit Tests
```bash
npm run test
npm run test:watch
npm run test:coverage
```

### E2E Tests
```bash
npm run test:e2e
```

### Testing Strategy
- Component testing
- Integration testing
- Accessibility testing
- Visual regression testing

## Deployment

### Docker Deployment

```bash
# Build image
docker build -t fullstack-auth-frontend .

# Run container
docker run -p 3000:80 fullstack-auth-frontend
```

### Static Hosting

**Vercel**
```bash
npm install -g vercel
vercel --prod
```

**Netlify**
```bash
npm run build
# Upload dist/ folder to Netlify
```

### Environment Setup

**Production Environment Variables**
```bash
VITE_API_URL=https://your-api-domain.com
VITE_APP_NAME=Your App Name
VITE_ENABLE_DEBUG=false
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Polyfills
- Included for older browsers
- Feature detection
- Graceful degradation

## Accessibility

### WCAG Compliance
- WCAG 2.1 AA compliant
- Screen reader support
- Keyboard navigation
- Color contrast compliance

### Features
- Semantic HTML
- ARIA labels
- Focus management
- Alt text for images

## Troubleshooting

### Common Issues

**Build Errors**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**API Connection Issues**
```bash
# Check environment variables
echo $VITE_API_URL

# Verify backend is running
curl http://localhost:5000/api/health
```

**Styling Issues**
```bash
# Rebuild Tailwind
npm run build:css
```

### Debug Mode
```bash
# Enable debug logging
VITE_ENABLE_DEBUG=true npm run dev
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Follow coding standards
4. Add tests
5. Submit pull request

### Coding Standards
- Use TypeScript
- Follow ESLint rules
- Write meaningful tests
- Document components

## License

MIT License - see LICENSE file for details
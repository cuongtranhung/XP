# DropdownMenu Component

A highly accessible, customizable, and feature-rich dropdown menu component for React applications.

## Features

- ✅ **Full Accessibility** - WCAG 2.1 AA compliant with keyboard navigation
- ✅ **Responsive Design** - Auto-positioning to prevent viewport overflow
- ✅ **Multiple Variants** - Success, danger, warning, info styling
- ✅ **Flexible Sizing** - Small, medium, large size options
- ✅ **Rich Menu Items** - Icons, descriptions, badges, shortcuts, dividers
- ✅ **Advanced Interactions** - Hover to open, async actions, loading states
- ✅ **TypeScript Support** - Fully typed with comprehensive interfaces
- ✅ **Customizable Styling** - Extensive className and styling options

## Basic Usage

```tsx
import { DropdownMenu, MenuItem } from './components/common/DropdownMenu';

const menuItems: MenuItem[] = [
  {
    id: 'edit',
    label: 'Edit',
    icon: <EditIcon />,
    onClick: () => handleEdit()
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: <TrashIcon />,
    onClick: async () => await handleDelete(),
    variant: 'danger',
    divider: true
  }
];

<DropdownMenu items={menuItems} />
```

## Props

### DropdownMenuProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `MenuItem[]` | - | Array of menu items to display |
| `triggerIcon` | `ReactNode` | `<MoreVertical />` | Custom trigger button icon |
| `className` | `string` | `''` | Additional CSS classes for container |
| `buttonClassName` | `string` | `''` | Additional CSS classes for trigger button |
| `menuClassName` | `string` | `''` | Additional CSS classes for dropdown menu |
| `position` | `'left' \| 'right' \| 'auto'` | `'right'` | Menu position relative to trigger |
| `align` | `'start' \| 'end' \| 'center'` | `'start'` | Menu alignment |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Component size variant |
| `triggerLabel` | `string` | `'Menu'` | ARIA label for trigger button |
| `loading` | `boolean` | `false` | Show loading spinner on trigger |
| `disabled` | `boolean` | `false` | Disable the entire dropdown |
| `maxHeight` | `number` | `384` | Maximum height in pixels |
| `closeOnSelect` | `boolean` | `true` | Close menu when item is clicked |
| `openOnHover` | `boolean` | `false` | Open menu on hover |
| `hoverDelay` | `number` | `200` | Delay before opening on hover |
| `onOpen` | `() => void` | - | Callback when menu opens |
| `onClose` | `() => void` | - | Callback when menu closes |

### MenuItem Interface

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `id` | `string` | - | Unique identifier |
| `label` | `string` | - | Display text |
| `icon` | `ReactNode` | - | Optional icon |
| `onClick` | `() => void \| Promise<void>` | - | Click handler |
| `variant` | `'default' \| 'success' \| 'danger' \| 'warning' \| 'info'` | `'default'` | Visual variant |
| `show` | `boolean` | `true` | Whether to show this item |
| `divider` | `boolean` | `false` | Show divider before this item |
| `disabled` | `boolean` | `false` | Disable this item |
| `description` | `string` | - | Optional description text |
| `shortcut` | `string` | - | Keyboard shortcut display |
| `badge` | `string \| number` | - | Badge text/number |
| `submenu` | `MenuItem[]` | - | Submenu items (future feature) |

## Examples

### Basic Menu

```tsx
<DropdownMenu 
  items={[
    { id: 'edit', label: 'Edit', onClick: () => {}, icon: <EditIcon /> },
    { id: 'delete', label: 'Delete', onClick: () => {}, variant: 'danger' }
  ]}
/>
```

### Advanced Configuration

```tsx
<DropdownMenu 
  items={menuItems}
  size="lg"
  position="auto"
  align="center"
  maxHeight={300}
  openOnHover={true}
  hoverDelay={100}
  closeOnSelect={false}
  onOpen={() => console.log('Menu opened')}
  onClose={() => console.log('Menu closed')}
/>
```

### Rich Menu Items

```tsx
const richItems: MenuItem[] = [
  {
    id: 'save',
    label: 'Save Document',
    description: 'Save changes to current document',
    icon: <SaveIcon />,
    shortcut: '⌘S',
    onClick: () => handleSave()
  },
  {
    id: 'export',
    label: 'Export',
    badge: 'Pro',
    icon: <ExportIcon />,
    variant: 'success',
    onClick: () => handleExport(),
    disabled: !isPro
  },
  {
    id: 'delete',
    label: 'Delete Forever',
    description: 'This action cannot be undone',
    icon: <TrashIcon />,
    variant: 'danger',
    divider: true,
    onClick: async () => {
      const confirmed = await confirmDelete();
      if (confirmed) handleDelete();
    }
  }
];
```

## Utility Functions

### createCommonActions

Create standard CRUD menu items:

```tsx
import { createCommonActions } from './components/common/DropdownMenu';

const actions = createCommonActions('item-1', {
  onView: () => handleView(),
  onEdit: () => handleEdit(),
  onDuplicate: () => handleDuplicate(),
  onDelete: () => handleDelete()
});

<DropdownMenu items={actions} />
```

### createMenuItem

Create individual menu items with defaults:

```tsx
import { createMenuItem } from './components/common/DropdownMenu';

const item = createMenuItem('edit', 'Edit Item', handleEdit, {
  icon: <EditIcon />,
  variant: 'default',
  shortcut: '⌘E'
});
```

## Keyboard Navigation

- **Space/Enter**: Open/close menu
- **Arrow Down**: Open menu and focus first item, or move to next item
- **Arrow Up**: Open menu and focus last item, or move to previous item
- **Escape**: Close menu and focus trigger
- **Tab**: Navigate through items or close menu
- **Home**: Focus first item
- **End**: Focus last item

## Accessibility Features

- Full ARIA support with proper roles and attributes
- Keyboard navigation following WAI-ARIA best practices
- Screen reader announcements
- Focus management and restoration
- High contrast mode support
- Reduced motion respect

## Styling Customization

The component uses Tailwind CSS classes and can be customized through:

1. **Props**: `className`, `buttonClassName`, `menuClassName`
2. **CSS Variables**: Override component-specific variables
3. **Tailwind Config**: Modify theme colors and spacing
4. **Custom CSS**: Target specific component classes

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Performance

- Optimized with React hooks (`useCallback`, `useMemo`)
- Lazy loading for large menu lists
- Efficient event handling with proper cleanup
- Minimal re-renders with state management

## Migration from v1

If upgrading from a previous version:

1. Import path changed: `import { DropdownMenu } from './DropdownMenu'`
2. `MenuItem` interface has new optional properties
3. New utility functions available for common use cases
4. Enhanced accessibility features (no breaking changes)

## Contributing

When contributing to this component:

1. Maintain accessibility standards
2. Add comprehensive tests for new features
3. Update TypeScript interfaces
4. Follow established code patterns
5. Update documentation
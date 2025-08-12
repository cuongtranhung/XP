#!/bin/bash

# Fix unused imports in frontend TypeScript files

cd /mnt/c/Users/Admin/source/repos/XP/frontend

# Fix LazyCharts.tsx
sed -i '/ComponentProps/d' src/components/charts/LazyCharts.tsx

# Fix FormBuilderSidebar.tsx
sed -i '/^import.*FieldType.*from.*types/d' src/components/formBuilder/FormBuilderSidebar.tsx

# Fix FormCanvas.tsx
sed -i 's/, Settings//g' src/components/formBuilder/FormCanvas.tsx

# Fix FormFieldRenderer.tsx
sed -i 's/, Upload//g' src/components/formBuilder/FormFieldRenderer.tsx
sed -i 's/, MapPin//g' src/components/formBuilder/FormFieldRenderer.tsx

# Fix FormSettings.tsx  
sed -i 's/, Webhook//g' src/components/formBuilder/FormSettings.tsx

# Fix WebhookSettings.tsx
sed -i '/CheckCircle/d' src/components/formBuilder/WebhookSettings.tsx
sed -i '/XCircle/d' src/components/formBuilder/WebhookSettings.tsx
sed -i '/AlertCircle/d' src/components/formBuilder/WebhookSettings.tsx

# Fix test files
sed -i 's/, fireEvent//g' src/components/formBuilder/__tests__/FormBuilder.test.tsx
sed -i '/DndContext/d' src/components/formBuilder/__tests__/FormBuilder.test.tsx
sed -i 's/, fireEvent//g' src/components/formBuilder/__tests__/FormRenderer.test.tsx

# Fix pages
sed -i 's/, BarChart3//g' src/pages/FormAnalytics.tsx
sed -i 's/, TrendingUp//g' src/pages/FormAnalytics.tsx
sed -i 's/, XCircle//g' src/pages/FormAnalytics.tsx
sed -i 's/, Calendar//g' src/pages/FormAnalytics.tsx
sed -i 's/, BarChart//g' src/pages/FormAnalytics.tsx
sed -i 's/, Layers//g' src/pages/FormBuilder.tsx
sed -i 's/, FormField//g' src/pages/FormBuilder.tsx
sed -i 's/, FormField//g' src/pages/FormBuilderPage.tsx
sed -i 's/, FormStep//g' src/pages/FormBuilderPage.tsx
sed -i 's/, Filter//g' src/pages/FormSubmissions.tsx
sed -i 's/, Calendar//g' src/pages/FormSubmissions.tsx
sed -i 's/, MoreVertical//g' src/pages/FormSubmissions.tsx
sed -i 's/, Filter//g' src/pages/FormsList.tsx
sed -i 's/, ExternalLink//g' src/pages/FormsList.tsx
sed -i '/^import.*Form.*from.*types/d' src/pages/FormsList.tsx

echo "Fixed unused imports"
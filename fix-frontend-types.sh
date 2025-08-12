#!/bin/bash

# Fix all type assertions in FormBuilderSidebar
cd /mnt/c/Users/Admin/source/repos/XP/frontend

# Fix type assertions for all field types
sed -i "s/type: 'textarea'/type: 'textarea' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'email'/type: 'email' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'number'/type: 'number' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'tel'/type: 'tel' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'url'/type: 'url' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'date'/type: 'date' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'time'/type: 'time' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'datetime-local'/type: 'datetime-local' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'select'/type: 'select' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'radio'/type: 'radio' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'checkbox'/type: 'checkbox' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'checkbox_group'/type: 'checkbox_group' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'file'/type: 'file' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'image'/type: 'image' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'rating'/type: 'rating' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'range'/type: 'range' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'signature'/type: 'signature' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'payment'/type: 'payment' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'location'/type: 'location' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'section'/type: 'section' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx
sed -i "s/type: 'divider'/type: 'divider' as FieldType/g" src/components/formBuilder/FormBuilderSidebar.tsx

# Fix unused imports
sed -i '/^import.*Upload.*from/d' src/components/formBuilder/FormFieldRenderer.tsx
sed -i '/^import.*MapPin.*from/d' src/components/formBuilder/FormFieldRenderer.tsx

# Remove unused imports in other files
sed -i 's/, BarChart3//g' src/pages/FormAnalytics.tsx
sed -i 's/, TrendingUp//g' src/pages/FormAnalytics.tsx
sed -i 's/, XCircle//g' src/pages/FormAnalytics.tsx
sed -i 's/, Calendar//g' src/pages/FormAnalytics.tsx
sed -i 's/, Layers//g' src/pages/FormBuilder.tsx
sed -i 's/, Filter//g' src/pages/FormSubmissions.tsx
sed -i 's/, Calendar//g' src/pages/FormSubmissions.tsx
sed -i 's/, MoreVertical//g' src/pages/FormSubmissions.tsx
sed -i 's/, Filter//g' src/pages/FormsList.tsx
sed -i 's/, ExternalLink//g' src/pages/FormsList.tsx

# Fix unused register in FormSettings
sed -i 's/const { register, watch, setValue } = useFormContext();/const { watch, setValue } = useFormContext();/g' src/components/formBuilder/FormSettings.tsx

# Fix unused watch in FormCanvas
sed -i 's/const watch = formContext?.watch || (() => undefined);/\/\/ const watch = formContext?.watch || (() => undefined);/g' src/components/formBuilder/FormCanvas.tsx

# Fix unused field in FormSubmit
sed -i 's/formData.fields?.forEach((field: FormField) => {/formData.fields?.forEach((_field: FormField) => {/g' src/pages/FormSubmit.tsx

# Fix unused useEffect in useFormBuilder
sed -i 's/import { useState, useCallback, useEffect } from '\''react'\'';/import { useState, useCallback } from '\''react'\'';/g' src/hooks/useFormBuilder.ts

echo "Fixed type assertions and unused imports"
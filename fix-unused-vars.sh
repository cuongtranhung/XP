#!/bin/bash

echo "🔧 Fixing unused variables in backend..."

# Fix unused imports - comment them out
sed -i "s/^import { canViewFormSubmissions/\/\/ import { canViewFormSubmissions/" backend/src/modules/dynamicFormBuilder/routes/formRoutes.ts
sed -i "s/^const listFormsValidation/\/\/ const listFormsValidation/" backend/src/modules/dynamicFormBuilder/routes/formRoutes.ts
sed -i "s/^const formIdValidation/\/\/ const formIdValidation/" backend/src/modules/dynamicFormBuilder/routes/submissionRoutes.ts
sed -i "s/^const submissionIdValidation/\/\/ const submissionIdValidation/" backend/src/modules/dynamicFormBuilder/routes/submissionRoutes.ts

# Fix unused destructuring - prefix with underscore
sed -i 's/import { authenticate,/import { \/\/ authenticate,/' backend/src/modules/dynamicFormBuilder/routes/uploadRoutes.ts
sed -i 's/const { querySchema, withSchemaTransaction }/const { \/\/ querySchema, withSchemaTransaction }/' backend/src/modules/dynamicFormBuilder/services/AnalyticsService.ts
sed -i 's/import logger/\/\/ import logger/' backend/src/modules/dynamicFormBuilder/services/ConflictResolutionService.ts
sed -i "s/import crypto/\/\/ import crypto/" backend/src/modules/dynamicFormBuilder/services/FileUploadService.ts

# Fix unused parameters - prefix with underscore
sed -i 's/(req/(\_req/g' backend/src/modules/dynamicFormBuilder/monitoring/index.ts
sed -i 's/notifyCollaborators/_notifyCollaborators/g' backend/src/modules/dynamicFormBuilder/controllers/FormController.ts
sed -i 's/const result =/const _result =/' backend/src/modules/dynamicFormBuilder/services/FileUploadService.ts
sed -i 's/const relativePath =/const _relativePath =/' backend/src/modules/dynamicFormBuilder/services/FileUploadService.ts
sed -i 's/const currentState =/const _currentState =/' backend/src/modules/dynamicFormBuilder/services/ConflictResolutionService.ts
sed -i 's/const metadata =/const _metadata =/' backend/src/modules/dynamicFormBuilder/services/AnalyticsService.ts
sed -i 's/const timezone =/const _timezone =/' backend/src/modules/dynamicFormBuilder/services/AnalyticsService.ts

echo "✅ Done fixing unused variables!"
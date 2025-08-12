/**
 * Conflict Resolution Service
 * Handles concurrent edit conflicts using operational transformation
 */

import { logger } from '../../../utils/logger';
import { FormField, Form } from '../types';

interface Operation {
  id: string;
  type: 'add' | 'update' | 'delete' | 'reorder';
  fieldId?: string;
  field?: FormField;
  position?: number;
  fromIndex?: number;
  toIndex?: number;
  updates?: Partial<FormField>;
  timestamp: Date;
  userId: string;
}

interface ConflictResolution {
  accepted: Operation[];
  rejected: Operation[];
  merged: Operation[];
}

export class ConflictResolutionService {
  private operationHistory: Map<string, Operation[]> = new Map();
  private conflictThreshold = 100; // milliseconds

  /**
   * Record an operation
   */
  recordOperation(formId: string, operation: Operation): void {
    if (!this.operationHistory.has(formId)) {
      this.operationHistory.set(formId, []);
    }
    
    const history = this.operationHistory.get(formId)!;
    history.push(operation);
    
    // Keep only last 1000 operations per form
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Resolve conflicts between concurrent operations
   */
  resolveConflicts(
    formId: string,
    incomingOperation: Operation,
    currentState: FormField[]
  ): ConflictResolution {
    const history = this.operationHistory.get(formId) || [];
    const concurrentOps = this.findConcurrentOperations(history, incomingOperation);
    
    const resolution: ConflictResolution = {
      accepted: [],
      rejected: [],
      merged: []
    };

    if (concurrentOps.length === 0) {
      // No conflicts
      resolution.accepted.push(incomingOperation);
      return resolution;
    }

    // Resolve conflicts based on operation type
    switch (incomingOperation.type) {
      case 'add':
        this.resolveAddConflict(incomingOperation, concurrentOps, resolution);
        break;
      case 'update':
        this.resolveUpdateConflict(incomingOperation, concurrentOps, resolution, currentState);
        break;
      case 'delete':
        this.resolveDeleteConflict(incomingOperation, concurrentOps, resolution);
        break;
      case 'reorder':
        this.resolveReorderConflict(incomingOperation, concurrentOps, resolution);
        break;
    }

    return resolution;
  }

  /**
   * Find operations that are concurrent with the incoming operation
   */
  private findConcurrentOperations(
    history: Operation[],
    incomingOp: Operation
  ): Operation[] {
    const threshold = this.conflictThreshold;
    const incomingTime = incomingOp.timestamp.getTime();
    
    return history.filter(op => {
      const opTime = op.timestamp.getTime();
      const timeDiff = Math.abs(opTime - incomingTime);
      
      // Operations are concurrent if they happened within threshold
      // and are from different users
      return timeDiff <= threshold && op.userId !== incomingOp.userId;
    });
  }

  /**
   * Resolve add operation conflicts
   */
  private resolveAddConflict(
    incomingOp: Operation,
    concurrentOps: Operation[],
    resolution: ConflictResolution
  ): void {
    // Check if another user added a field at the same position
    const conflictingAdds = concurrentOps.filter(
      op => op.type === 'add' && op.position === incomingOp.position
    );

    if (conflictingAdds.length > 0) {
      // Adjust position to avoid conflict
      const adjustedOp = { ...incomingOp };
      adjustedOp.position = (adjustedOp.position || 0) + conflictingAdds.length;
      resolution.merged.push(adjustedOp);
    } else {
      resolution.accepted.push(incomingOp);
    }
  }

  /**
   * Resolve update operation conflicts
   */
  private resolveUpdateConflict(
    incomingOp: Operation,
    concurrentOps: Operation[],
    resolution: ConflictResolution,
    currentState: FormField[]
  ): void {
    const fieldId = incomingOp.fieldId;
    if (!fieldId) {
      resolution.rejected.push(incomingOp);
      return;
    }

    // Check if field was deleted
    const deleteOps = concurrentOps.filter(
      op => op.type === 'delete' && op.fieldId === fieldId
    );
    
    if (deleteOps.length > 0) {
      resolution.rejected.push(incomingOp);
      return;
    }

    // Check for conflicting updates to the same field
    const updateOps = concurrentOps.filter(
      op => op.type === 'update' && op.fieldId === fieldId
    );

    if (updateOps.length > 0) {
      // Merge updates using last-write-wins for each property
      const mergedUpdates = this.mergeFieldUpdates(
        incomingOp.updates || {},
        updateOps.map(op => op.updates || {})
      );

      const mergedOp = { ...incomingOp, updates: mergedUpdates };
      resolution.merged.push(mergedOp);
    } else {
      resolution.accepted.push(incomingOp);
    }
  }

  /**
   * Resolve delete operation conflicts
   */
  private resolveDeleteConflict(
    incomingOp: Operation,
    concurrentOps: Operation[],
    resolution: ConflictResolution
  ): void {
    const fieldId = incomingOp.fieldId;
    if (!fieldId) {
      resolution.rejected.push(incomingOp);
      return;
    }

    // Check if another user already deleted the field
    const deleteOps = concurrentOps.filter(
      op => op.type === 'delete' && op.fieldId === fieldId
    );

    if (deleteOps.length > 0) {
      // Field already deleted, reject operation
      resolution.rejected.push(incomingOp);
    } else {
      // Check if field was updated concurrently
      const updateOps = concurrentOps.filter(
        op => op.type === 'update' && op.fieldId === fieldId
      );

      if (updateOps.length > 0) {
        // Prioritize delete over update
        resolution.accepted.push(incomingOp);
      } else {
        resolution.accepted.push(incomingOp);
      }
    }
  }

  /**
   * Resolve reorder operation conflicts
   */
  private resolveReorderConflict(
    incomingOp: Operation,
    concurrentOps: Operation[],
    resolution: ConflictResolution
  ): void {
    const reorderOps = concurrentOps.filter(op => op.type === 'reorder');

    if (reorderOps.length > 0) {
      // Transform indices based on concurrent reorders
      let fromIndex = incomingOp.fromIndex || 0;
      let toIndex = incomingOp.toIndex || 0;

      for (const op of reorderOps) {
        const result = this.transformIndices(
          fromIndex,
          toIndex,
          op.fromIndex || 0,
          op.toIndex || 0
        );
        fromIndex = result.fromIndex;
        toIndex = result.toIndex;
      }

      const transformedOp = {
        ...incomingOp,
        fromIndex,
        toIndex
      };
      resolution.merged.push(transformedOp);
    } else {
      resolution.accepted.push(incomingOp);
    }
  }

  /**
   * Merge field updates from multiple operations
   */
  private mergeFieldUpdates(
    incoming: Partial<FormField>,
    concurrent: Partial<FormField>[]
  ): Partial<FormField> {
    const merged = { ...incoming };

    // For each concurrent update, apply properties that don't conflict
    for (const update of concurrent) {
      for (const [key, value] of Object.entries(update)) {
        // Simple last-write-wins strategy
        // Could be enhanced with more sophisticated merging
        if (!(key in merged)) {
          (merged as any)[key] = value;
        }
      }
    }

    return merged;
  }

  /**
   * Transform indices for concurrent reorder operations
   */
  private transformIndices(
    fromIndex1: number,
    toIndex1: number,
    fromIndex2: number,
    toIndex2: number
  ): { fromIndex: number; toIndex: number } {
    let newFromIndex = fromIndex1;
    let newToIndex = toIndex1;

    // Adjust indices based on the other operation
    if (fromIndex2 < fromIndex1) {
      newFromIndex--;
    }
    if (fromIndex2 < toIndex1) {
      newToIndex--;
    }
    if (toIndex2 <= fromIndex1) {
      newFromIndex++;
    }
    if (toIndex2 <= toIndex1) {
      newToIndex++;
    }

    return {
      fromIndex: Math.max(0, newFromIndex),
      toIndex: Math.max(0, newToIndex)
    };
  }

  /**
   * Apply resolved operations to form state
   */
  applyOperations(
    fields: FormField[],
    operations: Operation[]
  ): FormField[] {
    let result = [...fields];

    for (const op of operations) {
      switch (op.type) {
        case 'add':
          if (op.field && op.position !== undefined) {
            result.splice(op.position, 0, op.field);
          }
          break;

        case 'update':
          if (op.fieldId && op.updates) {
            const index = result.findIndex(f => f.id === op.fieldId);
            if (index !== -1) {
              result[index] = { ...result[index], ...op.updates };
            }
          }
          break;

        case 'delete':
          if (op.fieldId) {
            result = result.filter(f => f.id !== op.fieldId);
          }
          break;

        case 'reorder':
          if (op.fromIndex !== undefined && op.toIndex !== undefined) {
            const [removed] = result.splice(op.fromIndex, 1);
            if (removed) {
              result.splice(op.toIndex, 0, removed);
            }
          }
          break;
      }
    }

    // Update positions
    return result.map((field, index) => ({
      ...field,
      position: index
    }));
  }

  /**
   * Clean up old operation history
   */
  cleanupHistory(olderThan: Date): void {
    const cutoffTime = olderThan.getTime();

    this.operationHistory.forEach((operations, formId) => {
      const filtered = operations.filter(
        op => op.timestamp.getTime() > cutoffTime
      );
      
      if (filtered.length === 0) {
        this.operationHistory.delete(formId);
      } else {
        this.operationHistory.set(formId, filtered);
      }
    });
  }
}

export default new ConflictResolutionService();
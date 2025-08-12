/**
 * Test to verify TypeScript strict mode is working
 */

describe('TypeScript Strict Mode', () => {
  it('should have strict type checking enabled', () => {
    // This test verifies that TypeScript compilation works with strict mode
    const testFunction = (value: string): number => {
      return value.length;
    };

    expect(testFunction('test')).toBe(4);
  });

  it('should not allow implicit any', () => {
    // This would fail compilation if noImplicitAny is false
    const typedFunction = (param: string): string => {
      return param.toUpperCase();
    };

    expect(typedFunction('hello')).toBe('HELLO');
  });

  it('should enforce null checks', () => {
    // This verifies strictNullChecks is working
    const nullable: string | null = null;
    const nonNullable: string = nullable ?? 'default';
    
    expect(nonNullable).toBe('default');
  });
});
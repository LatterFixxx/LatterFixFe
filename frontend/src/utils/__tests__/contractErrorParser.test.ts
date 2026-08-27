import { describe, it, expect } from 'vitest';
import { parseContractError } from '../contractErrorParser';

describe('contractErrorParser', () => {
  it('should parse known contract errors from simulation string', () => {
    const error1 = parseContractError(undefined, 'Error(Contract, 1)');
    expect(error1.code).toBe('CONTRACT_ERR_1');
    expect(error1.message).toBe('Contract already initialized');
    expect(error1.suggestedAction).toBe(
      'The contract has already been set up. No further initialization is required.'
    );

    const error5 = parseContractError(undefined, 'Error(Contract, 5)');
    expect(error5.code).toBe('CONTRACT_ERR_5');
    expect(error5.message).toBe('Batch size too large');

    const error9 = parseContractError(undefined, 'Error(Contract, 9)');
    expect(error9.code).toBe('CONTRACT_ERR_9');
    expect(error9.message).toBe('Batch not found');
  });

  it('should fallback for generic unauthorized simulation error', () => {
    const unauthorizedErr = parseContractError(undefined, 'Some unauthorized access error');
    expect(unauthorizedErr.code).toBe('UNAUTHORIZED');
    expect(unauthorizedErr.message).toBe('Unauthorized contract invocation.');
  });

  it('should fallback to generic error when code is unknown', () => {
    const unknownErr = parseContractError(undefined, 'Error(Contract, 999)');
    expect(unknownErr.code).toBe('UNKNOWN_CONTRACT_ERROR');
    expect(unknownErr.message).toBe('Error(Contract, 999)');
  });
});

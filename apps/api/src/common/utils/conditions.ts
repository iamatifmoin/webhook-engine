import type { AutomationRuleCondition } from '../../modules/automation-rules/automation-rules.schema';
import { getValueByPath } from './object-path';

export function evaluateConditions(
  payload: Record<string, unknown>,
  conditions: AutomationRuleCondition[],
): boolean {
  if (conditions.length === 0) {
    return true;
  }

  return conditions.every((condition) => {
    const value = getValueByPath(payload, condition.field);

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'contains':
        return String(value ?? '').includes(String(condition.value ?? ''));
      default:
        return false;
    }
  });
}

import { Transaction, AppData, Entity } from '../types';
import { DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from './categories';

const STORAGE_KEY = 'cashbook_app_data';

const DEFAULT_APP_DATA: AppData = {
  entities: [],
  currentEntityId: '',
  transactions: {},
  categories: {
    income: DEFAULT_INCOME_CATEGORIES,
    expense: DEFAULT_EXPENSE_CATEGORIES
  }
};

export const saveAppData = (data: AppData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loadAppData = (): AppData => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    return DEFAULT_APP_DATA;
  }

  const parsedData = JSON.parse(data) as Partial<AppData>;
  const entities = Array.isArray(parsedData.entities)
    ? parsedData.entities.map((entity) => ({
        ...entity,
        name: entity.name || '',
        gstin: entity.gstin || '',
        createdAt: entity.createdAt || new Date().toISOString()
      }))
    : [];

  return {
    entities,
    currentEntityId: parsedData.currentEntityId || entities[0]?.id || '',
    transactions: Object.fromEntries(
      Object.entries(parsedData.transactions || {}).map(([entityId, entityTransactions]) => [
        entityId,
        Array.isArray(entityTransactions)
          ? entityTransactions.map((transaction) => ({
              ...transaction,
              source: transaction.source || 'manual'
            }))
          : []
      ])
    ),
    categories: {
      income: parsedData.categories?.income || DEFAULT_INCOME_CATEGORIES,
      expense: parsedData.categories?.expense || DEFAULT_EXPENSE_CATEGORIES
    }
  };
};

export const createEntity = (name: string, gstin = ''): Entity => {
  return {
    id: crypto.randomUUID(),
    name,
    gstin,
    createdAt: new Date().toISOString()
  };
};

export const addEntity = (appData: AppData, entity: Entity): AppData => {
  const updated = {
    ...appData,
    entities: [...appData.entities, entity],
    currentEntityId: entity.id,
    transactions: {
      ...appData.transactions,
      [entity.id]: []
    }
  };
  saveAppData(updated);
  return updated;
};

export const switchEntity = (appData: AppData, entityId: string): AppData => {
  const updated = {
    ...appData,
    currentEntityId: entityId
  };
  saveAppData(updated);
  return updated;
};

export const updateEntity = (
  appData: AppData,
  entityId: string,
  updates: Pick<Entity, 'name' | 'gstin'>
): AppData => {
  const updated = {
    ...appData,
    entities: appData.entities.map((entity) =>
      entity.id === entityId
        ? {
            ...entity,
            name: updates.name,
            gstin: updates.gstin
          }
        : entity
    )
  };
  saveAppData(updated);
  return updated;
};

export const deleteEntity = (appData: AppData, entityId: string): AppData => {
  const filtered = appData.entities.filter((e) => e.id !== entityId);
  const { [entityId]: _, ...remainingTransactions } = appData.transactions;
  const newCurrentId = filtered.length > 0 ? filtered[0].id : '';

  const updated = {
    ...appData,
    entities: filtered,
    currentEntityId: newCurrentId,
    transactions: remainingTransactions
  };
  saveAppData(updated);
  return updated;
};

export const saveTransactionForEntity = (
  appData: AppData,
  entityId: string,
  transactions: Transaction[]
): AppData => {
  const updated = {
    ...appData,
    transactions: {
      ...appData.transactions,
      [entityId]: transactions
    }
  };
  saveAppData(updated);
  return updated;
};

export const updateCategories = (appData: AppData, income: string[], expense: string[]): AppData => {
  const updated = {
    ...appData,
    categories: { income, expense }
  };
  saveAppData(updated);
  return updated;
};

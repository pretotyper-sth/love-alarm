import { useSyncExternalStore } from 'react';
import { accountData } from './api';

export function useAccountData() {
  return useSyncExternalStore(accountData.subscribe, accountData.getSnapshot);
}

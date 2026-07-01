import type { StorageSchema } from "./schema";

export async function getStorageValue<K extends keyof StorageSchema>(
  key: K,
): Promise<StorageSchema[K] | undefined> {
  const result = await chrome.storage.local.get<Pick<StorageSchema, K>>(key);
  return result[key];
}

export async function setStorageValue<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K],
): Promise<void> {
  await chrome.storage.local.set<Pick<StorageSchema, K>>({
    [key]: value,
  } as Pick<StorageSchema, K>);
}
